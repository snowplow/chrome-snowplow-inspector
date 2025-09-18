import { h, type FunctionComponent } from "preact";
import {
  type Dispatch,
  type StateUpdater,
  useEffect,
  useState,
} from "preact/hooks";

import { IgluSchema, type IgluUri, Resolver } from "../../../ts/iglu";
import type { BeaconValidity, IBeaconSummary } from "../../../ts/types";
import { colorOf, tryb64 } from "../../../ts/util";

const validationCache = new Map<string, BeaconValidity>();
const validateEvent = (
  id: string,
  params: Map<string, string>,
  resolver: Resolver,
  updateValidity: Dispatch<StateUpdater<BeaconValidity>>,
) => {
  type SDJ = { schema: IgluUri; data: object | SDJ[] };

  if (validationCache.has(id)) {
    return validationCache.get(id)!;
  }

  const ctxKeys = ["cx", "co"];
  const ueKeys = ["ue_pr", "ue_px"];
  const validatableKeys = ctxKeys.concat(ueKeys);

  const validate = (
    schema: IgluSchema | null,
    data: SDJ["data"],
  ): Promise<BeaconValidity> =>
    schema
      ? resolver
          .resolve(schema)
          .then((res) =>
            Promise.resolve(res.validate(data).valid ? "Valid" : "Invalid"),
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
            validate(schema, (sdj.data as SDJ).data).catch(
              () => "Unrecognised",
            ),
          );
        // this means data is not an SDJ. This is technically an invalid payload, but could just be old-style unstruct events.
        // the beacon view will show it as invalid, but to reduce UI noise, just pretend it's unrecognised because there is no
        // identifiable schema. This is a legacy behaviour so we'll make an exception here.
        else validations.push(Promise.resolve("Unrecognised"));
      } else if (Array.isArray(sdj.data)) {
        sdj.data.forEach((ctx: SDJ | null) => {
          if (!ctx) {
            validations.push(Promise.resolve("Invalid"));
          } else {
            schema = IgluSchema.fromUri(ctx.schema);
            validations.push(
              validate(schema, ctx.data).catch(() => "Unrecognised"),
            );
          }
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

    if (!unrec) {
      validationCache.set(id, valid ? "Valid" : "Invalid");
      updateValidity(valid ? "Valid" : "Invalid");
    }
  });

  return validationCache.get(id) || "Unrecognised";
};

export const EventEntry: FunctionComponent<{
  event: IBeaconSummary;
  isActive: boolean;
  resolver: Resolver;
  setActive: (summary: IBeaconSummary) => void;
}> = ({ event, isActive, resolver, setActive }) => {
  const { time, collector, appId, collectorStatus, eventName } = event;
  const [validity, setValidity] = useState<BeaconValidity>("Unrecognised");

  useEffect(() => {
    validateEvent(event.id, event.payload, resolver, setValidity);
  }, []);

  return (
    <a
      class={[
        "event",
        isActive ? "event--active" : "",
        // Some race in Firefox where the response information isn't always populated
        collectorStatus.code === 200 ||
        (collectorStatus.code === 0 &&
          collectorStatus.text !== "net::ERR_BLOCKED_BY_CLIENT")
          ? ""
          : "event--uncollected",
        `event--destination-${colorOf(collector + appId)}`,
        validity === "Invalid"
          ? "event--invalid"
          : validity === "Valid"
            ? "event--valid"
            : "event--unrecognised",
      ].join(" ")}
      title={[
        `Time: ${time}`,
        `Collector: ${collector}`,
        `App ID: ${appId}`,
        `Status: ${collectorStatus.code} ${collectorStatus.text}`,
        `Validity: ${validity}`,
      ].join("\n")}
      onClick={setActive.bind(null, event)}
    >
      {eventName}
    </a>
  );
};
