import { Entry } from "har-format";
import { default as m, Component, Vnode } from "mithril";
import { trackerAnalytics } from "../../ts/analytics";
import { IgluSchema, IgluUri, Resolver } from "../../ts/iglu";
import { protocol } from "../../ts/protocol";
import { BeaconValidity, IBeaconSummary, ITimeline } from "../../ts/types";
import { b64d, colorOf, hash, tryb64 } from "../../ts/util";

const GA_REQUIRED_FIELDS = ["tid", "cid", "t", "v", "_gid"];

const filterRequest = (beacon: IBeaconSummary, filter?: RegExp) => {
  return (
    typeof filter === "undefined" ||
    (beacon.appId && filter.test(beacon.appId)) ||
    filter.test(beacon.collector) ||
    filter.test(beacon.eventName) ||
    filter.test(beacon.method) ||
    (beacon.page && filter.test(beacon.page)) ||
    (Array.from(beacon.payload.values()) as string[]).filter((x) => {
      let decoded: string | null;
      try {
        decoded = b64d(x);
      } catch (e) {
        decoded = null;
      }

      return filter.test(decoded || "") || filter.test(x);
    }).length > 0
  );
};

const nameEvent = (params: Map<string, string>): string => {
  if (GA_REQUIRED_FIELDS.every((k) => params.has(k))) {
    const event = params.get("t") || "Unknown GA Event";
    const eventDef = protocol.gaMap.t.values;
    return eventDef[event] || event;
  }

  const event = params.get("e") || "Unknown Event";

  const eventDef = protocol.paramMap.e;
  if (eventDef.type !== "emap") return event;

  const eventTypes = eventDef.values;
  switch (event) {
    case "se":
      return eventTypes[event] + ": " + params.get("se_ca");
    case "ue":
      const payload = params.get("ue_pr") || params.get("ue_px") || "";
      let sdeName = "Unstructured";
      let sde = null;

      try {
        sde = JSON.parse(tryb64(payload));
      } catch (e) {
        sde = JSON.parse(payload);
      } finally {
        if (
          typeof sde === "object" &&
          sde !== null &&
          sde.hasOwnProperty("schema") &&
          sde.hasOwnProperty("data")
        ) {
          sdeName = sde.data.schema || "Unstructured";
          if (sdeName.startsWith("iglu:")) {
            sdeName = sdeName.split("/")[1];
          }
        }
      }

      return "SD Event: " + sdeName;
    case "pp":
    case "pv":
    case "ti":
    case "tr":
      return eventTypes[event];
    default:
      return event;
  }
};

const validationCache = new Map<string, BeaconValidity>();
const validateEvent = (
  id: string,
  params: Map<string, string>,
  resolver: Resolver
) => {
  type SDJ = { schema: IgluUri; data: object | SDJ[] };

  if (validationCache.has(id)) {
    return validationCache.get(id)!;
  } else {
    validationCache.set(id, "Unrecognised");
  }

  const ctxKeys = ["cx", "co"];
  const ueKeys = ["ue_pr", "ue_px"];
  const validatableKeys = ctxKeys.concat(ueKeys);

  const validate = (
    schema: IgluSchema | null,
    data: SDJ["data"]
  ): Promise<BeaconValidity> =>
    schema
      ? resolver
          .resolve(schema)
          .then((res) =>
            Promise.resolve(res.validate(data).valid ? "Valid" : "Invalid")
          )
      : Promise.resolve("Invalid");
  const validations: Promise<BeaconValidity>[] = [];
  validatableKeys.forEach((key) => {
    const payload = params.get(key);
    if (!payload) return;

    let json: unknown;
    let schema: IgluSchema | null;

    try {
      json = JSON.parse(tryb64(payload));
    } catch (e) {
      console.log(e);
    }

    if (
      typeof json === "object" &&
      json !== null &&
      "schema" in json &&
      "data" in json
    ) {
      const sdj = json as SDJ;
      schema = IgluSchema.fromUri(sdj.schema);
      validations.push(validate(schema, sdj.data).catch(() => "Unrecognised"));

      if (ueKeys.includes(key)) {
        schema = IgluSchema.fromUri((sdj.data as SDJ).schema);
        if (schema)
          validations.push(
            validate(schema, (sdj.data as SDJ).data).catch(() => "Unrecognised")
          );
        // this means data is not an SDJ. This is technically an invalid payload, but could just be old-style unstruct events.
        // the beacon view will show it as invalid, but to reduce UI noise, just pretend it's unrecognised because there is no
        // identifiable schema. This is a legacy behaviour so we'll make an exception here.
        else validations.push(Promise.resolve("Unrecognised"));
      } else if (Array.isArray(sdj.data)) {
        sdj.data.forEach((ctx: SDJ) => {
          schema = IgluSchema.fromUri(ctx.schema);
          validations.push(
            validate(schema, ctx.data).catch(() => "Unrecognised")
          );
        });
      } else {
        console.error("Expected Contexts SDJ to contain Array data");
        validations.push(Promise.resolve("Invalid"));
      }
    } else {
      validations.push(Promise.resolve("Invalid"));
    }
  });

  Promise.all(validations).then((results) => {
    let unrec = false;
    let valid = true;

    for (const result of results) {
      unrec = unrec || result === "Unrecognised";
      valid = valid && result === "Valid";
    }

    validationCache.set(
      id,
      unrec ? "Unrecognised" : valid ? "Valid" : "Invalid"
    );
    m.redraw();
  });

  return validationCache.get(id)!;
};

const summariseBeacons = (
  entry: Entry,
  index: number,
  resolver: Resolver,
  filter?: RegExp
): IBeaconSummary[] => {
  const reqs = extractRequests(entry, index);
  const [[id, collector, method], requests] = reqs;

  const results = [];

  for (const [i, req] of requests.entries()) {
    const result: IBeaconSummary = {
      appId: req.get("aid"),
      collector,
      eventName: nameEvent(req),
      id: `#${id}-${i}`,
      method,
      page: req.get("url") || req.get("dl"),
      payload: new Map(req),
      time: new Date(
        parseInt(
          req.get("stm") ||
            req.get("dtm") ||
            (req.get("_gid") ? req.get("_gid") + "000" : "").split(".").pop() ||
            "",
          10
        ) || +new Date()
      ).toJSON(),
      validity: validateEvent(`#${id}-${i}`, req, resolver),
    };

    trackerAnalytics(collector, result.page, result.appId);

    if (filterRequest(result, filter)) {
      results.push(result);
    }
  }

  return results;
};

const getPageUrl = (entries: Entry[]) => {
  let page: Entry["request"]["headers"][number] | undefined;
  entries.find(
    (entry) =>
      (page = entry.request.headers.find((x) => /referr?er/i.test(x.name)))
  );
  if (page) {
    return new URL(page.value);
  }

  return null;
};

const extractRequests = (
  entry: Entry,
  index: number
): [[string, string, string], Map<string, string>[]] => {
  const req = entry.request;
  const id =
    entry.pageref +
    hash(new Date(entry.startedDateTime).toJSON() + req.url + index);
  const collector = new URL(req.url).hostname;
  const method = req.method;
  const beacons = [];

  const nuid = entry.request.cookies.filter((x) => x.name === "sp")[0];
  const ua = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "user-agent"
  );
  const lang = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "accept-language"
  );
  const refr = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "referer"
  );
  const ct = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "content-type"
  );

  if (req.method === "POST" && ct != null && entry.request.bodySize) {
    try {
      if (req.postData === undefined || !req.postData.text) {
        throw new Error("POST request unexpectedly had no body.");
      }

      const payload = JSON.parse(req.postData.text);

      for (const pl of payload.data) {
        const beacon: Map<string, string> = new Map(Object.entries(pl));
        if (nuid && !beacon.has("nuid")) {
          beacon.set("nuid", nuid.value);
        }
        if (ua && !beacon.has("ua")) {
          beacon.set("ua", ua.value);
        }
        if (lang && !beacon.has("lang")) {
          beacon.set("lang", lang.value);
        }
        if (refr && !beacon.has("url")) {
          beacon.set("url", refr.value);
        }

        beacons.push(beacon);
      }
    } catch (jsonErr) {
      try {
        if (req.postData != null && req.postData.text) {
          const ga = req.postData.text.split("\n").map((line) => {
            const payload: Map<string, string> = new Map();
            new URLSearchParams(line).forEach((val, key) => {
              payload.set(key, val);
            });

            return payload;
          });

          const validGa = ga.filter((b) =>
            GA_REQUIRED_FIELDS.every((k) => b.has(k))
          );
          beacons.push.apply(beacons, validGa);
        } else {
          throw new Error(
            "Expected Google Analytics Measurement Protocol data"
          );
        }
      } catch (urlErr) {
        console.log("=================");
        console.log([jsonErr, urlErr].join("\n"));
        console.log(JSON.stringify(req));
        console.log("=================");
      }
    }
  } else {
    const beacon: Map<string, string> = new Map();
    new URL(req.url).searchParams.forEach((value, key) =>
      beacon.set(key, value)
    );
    if (nuid && !beacon.has("nuid")) {
      beacon.set("nuid", nuid.value);
    }
    if (ua && !beacon.has("ua")) {
      beacon.set("ua", ua.value);
    }
    if (lang && !beacon.has("lang")) {
      const langval = /^[^;,]+/.exec(lang.value);
      beacon.set("lang", langval ? langval[0] : lang.value);
    }
    if (refr && !beacon.has("url")) {
      beacon.set("url", refr.value);
    }

    beacons.push(beacon);
  }

  return [[id, collector, method], beacons];
};

export const Timeline: Component<ITimeline> = {
  view: ({ attrs: { filter, isActive, requests, resolver, setActive } }) => {
    const fallbackUrl = getPageUrl(requests);
    let first: IBeaconSummary | undefined = undefined;
    let active = false;
    const beacons = requests.map((x, i) => {
      const summary = summariseBeacons(x, i, resolver, filter);
      first = first || summary[0];
      return summary.map((y): [URL | null, Vnode] => [
        y.page ? new URL(y.page) : fallbackUrl,
        m(
          "a.panel-block",
          {
            class: [
              isActive(y) ? ((active = true), "is-active") : "",
              // Some race in Firefox where the response information isn't always populated
              x.response.status === 200 || x.response.status === 0
                ? ""
                : "not-ok",
              colorOf(y.collector + y.appId),
              y.validity === "Invalid" ? "is-invalid" : "",
            ].join(" "),
            onclick: setActive.bind(null, y),
            title: [
              `Time: ${y.time}`,
              `Collector: ${y.collector}`,
              `App ID: ${y.appId}`,
              `Status: ${x.response.status} ${x.response.statusText}`,
              `Validity: ${y.validity}`,
            ].join("\n"),
          },
          m("span.panel-icon.identifier"),
          y.eventName,
          m(
            "span.panel-icon.validity",
            y.validity === "Invalid" ? "\u26d4\ufe0f" : ""
          )
        ),
      ]);
    });
    chrome.browserAction.setBadgeText({
      tabId: chrome.devtools.inspectedWindow.tabId,
      text: "" + beacons.length,
    });
    if (!active && first) setActive(first);
    return beacons
      .reduce(
        (acc, batch) =>
          batch.reduce((acc, [url, beacon]) => {
            const key = url ? url.pathname.slice(0, 34) : "Current Page";
            const tail = acc.pop() || [key, []];
            if (tail[0] === key) {
              tail[1].push(beacon);
              acc.push(tail);
            } else {
              acc.push(tail);
              acc.push([key, [beacon]]);
            }
            return acc;
          }, acc),
        [] as [string, Vnode[]][]
      )
      .map(([pageName, beacons]) =>
        m(
          "div.panel",
          m("p.panel-heading", { title: pageName }, pageName),
          beacons
        )
      );
  },
};
