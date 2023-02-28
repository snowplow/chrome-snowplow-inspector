import { Entry } from "har-format";

import { protocol } from "../../../ts/protocol";
import { IBeaconSummary } from "../../../ts/types";
import { tryb64 } from "../../../ts/util";

export default (requests: Entry[], events: IBeaconSummary[][]): File => {
  const header = Object.keys(protocol.paramMap);

  return new File(
    [
      new Blob(
        [
          header.join(","),
          "\r\n",
          events
            .flatMap((summaries) =>
              summaries.map(({ payload }) =>
                header
                  .map((field) => {
                    let val = payload.get(field) || "";

                    if (field === "cx") {
                      val = tryb64(val);
                      field = "co";
                    } else if (field === "ue_px") {
                      val = tryb64(val);
                      field = "ue_pr";
                    }

                    if (val.includes(",")) {
                      return ["", val.replace(/"/g, '""'), ""].join('"');
                    } else {
                      return val;
                    }
                  })
                  .join(",")
              )
            )
            .join("\r\n"),
        ],
        { type: "text/csv" }
      ),
    ],
    "Snowplow Inspector Export.csv"
  );
};
