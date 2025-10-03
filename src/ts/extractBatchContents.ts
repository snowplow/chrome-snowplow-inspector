import type { Cookie, Entry } from "har-format";

import { hash } from "./util";
import type { BatchContents } from "./types";

export const GA_REQUIRED_FIELDS = ["tid", "cid", "t", "v", "_gid"] as const;

const extractNetworkUserId = (cookies: Cookie[]): Cookie | undefined => {
  // consider only cookies with the UUID format
  const uuidRegexp =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidCookies = cookies.filter(({ value }) => uuidRegexp.test(value));
  // prefer a cookie with the name `sp` or take the first one
  return uuidCookies.find((x) => x.name === "sp") ?? uuidCookies.shift();
};

export const extractBatchContents = (
  { request, response, pageref, startedDateTime }: Entry,
  index: number,
): BatchContents => {
  const { headers, method, postData, url } = request;
  const ref = pageref && /^page_\d+/.test(pageref) ? "beacon" : pageref;
  const id = ref + hash(new Date(startedDateTime).toJSON() + url + index);

  const collectorUrl = new URL(url);
  const collector = collectorUrl.hostname;
  const collectorPath = collectorUrl.pathname;
  const events: Map<string, string>[] = [];

  // These fields are set by enrich based on the headers sent to/from the collector
  // Extract these manually so we can display them if they aren't explicitly set
  const nuid = extractNetworkUserId(response.cookies)?.value;
  const ua = headers.find(
    ({ name }) => name.toLowerCase() === "user-agent",
  )?.value;
  const lang = headers.find(
    ({ name }) => name.toLowerCase() === "accept-language",
  )?.value;
  const refr = headers.find(
    ({ name }) => name.toLowerCase() === "referer",
  )?.value;
  const cl = headers.find(
    ({ name }) => name.toLowerCase() === "content-length",
  )?.value;
  const ct = headers.find(
    ({ name }) => name.toLowerCase() === "content-type",
  )?.value;

  const serverAnonymous = headers.some(
    ({ name, value }) => name.toLowerCase() === "sp-anonymous" && value === "*",
  );

  if (method.toUpperCase() === "POST") {
    if (postData == null && cl != null && parseInt(cl, 10) > 0) {
      const event = new Map(
        Object.entries({
          error: [
            "A post request to a known tracker URL was seen, but we could not extract the request body.",
            "This is usually the result of a request sent with the `beacon` eventMethod",
            "as a page is unloaded (e.g. a link click or form submission event that navigates to a new page).",
            "The browser is unable to supply the request body without a reference to the page, so we can't display the events.",
            "Although we can not inspect the event, it was probably correctly sent to the collector.",
          ].join(" "),
          e: "Unknown Event",
          endpoint: url,
          payloadSize: cl,
          contentType: ct ?? "",
          stm: String(+new Date()),
        }),
      );

      events.push(event);
    } else if (postData && postData.text) {
      try {
        const payload: unknown = JSON.parse(postData.text);

        if (!payload || typeof payload !== "object")
          throw Error("Expected Snowplow payload_data SDJ, got non-object");
        if (!("schema" in payload && "data" in payload))
          throw Error("Expected Snowplow payload_data SDJ");
        if (
          typeof payload.schema !== "string" ||
          !/\/payload_data\//.test(payload.schema)
        )
          throw Error("Unexpectedly got non-payload_data SDJ");
        if (!Array.isArray(payload.data))
          throw Error("Invalid payload_data object without array for data");

        for (const pl of payload.data) {
          events.push(new Map(Object.entries(pl)));
        }
      } catch (jsonErr) {
        try {
          const ga = postData.text
            .split("\n")
            .map((line) => new Map(new URLSearchParams(line)));

          const validGa = ga.filter((b) =>
            GA_REQUIRED_FIELDS.every((k) => b.has(k)),
          );
          events.push(...validGa);
        } catch (urlErr) {
          console.error("Invalid request payload", request, [jsonErr, urlErr]);
        }
      }
    } else {
      console.error("Unexpected empty body in request", request);
    }
  } else {
    // GET request, parse the params
    const event = new Map(collectorUrl.searchParams);

    if (lang && !event.has("lang")) {
      const langval = /^[^;,]+/.exec(lang);
      event.set("lang", langval ? langval[0] : lang);
    }

    events.push(event);
  }

  events.forEach((event) => {
    if (nuid && !event.has("nuid")) {
      event.set("nuid", nuid);
    }
    if (ua && !event.has("ua")) {
      event.set("ua", ua);
    }
    if (lang && !event.has("lang")) {
      event.set("lang", lang);
    }
    if (refr && !event.has("url")) {
      event.set("url", refr);
    }
  });

  return {
    id,
    collector,
    collectorPath,
    method,
    pageref: ref,
    events,
    serverAnonymous,
    status: response.status,
    statusText: (response as any)._error || response.statusText,
    sendingPage: headers.find(({ name }) => /referr?er/i.test(name))?.value,
  };
};
