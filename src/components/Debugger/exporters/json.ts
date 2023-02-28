import { Entry } from "har-format";

import { IBeaconSummary } from "../../../ts/types";

export default (requests: Entry[], events: IBeaconSummary[][]): File => {
  return new File(
    [
      new Blob(
        [
          JSON.stringify(
            events.flatMap((summaries) =>
              summaries.map(({ payload }) =>
                Object.fromEntries(payload.entries())
              )
            )
          ),
        ],
        { type: "application/json" }
      ),
    ],
    "Snowplow Inspector Export.json"
  );
};
