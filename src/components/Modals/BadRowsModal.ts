import { default as m, Vnode } from "mithril";
import { IBadRowsSummary } from "../../ts/types";
import { badToRequests } from "../../ts/util";

let badRows: string[] = [];

export const BadRowsModal = {
  view: (vnode: Vnode<IBadRowsSummary>) =>
    m(
      "div.modal",
      {
        className:
          vnode.attrs.modal === "badRows" ? "is-active" : "is-inactive",
      },
      [
        m("div.modal-background"),
        m("div.modal-card", [
          m("header.modal-card-head", [
            m("p.modal-card-title", "Bad Rows Import"),
            m("button.delete", {
              onclick: () => vnode.attrs.setModal(undefined),
            }),
          ]),
          m("section.modal-card-body", [
            m(
              "p",
              `Bad Rows occur when events fail to validate during enrichment.
                            You can paste your bad data straight from S3 (1 JSON object per line),
                            or, for real-time data, the JSON object from the _source field in ElasticSearch
                            or just the line property of that object. Keep pasting to include events in bulk.
                            Invalid payloads (OPTIONS requests, no data, invalid JSON, bots, etc.) will be ignored.`
            ),
            m("textarea.textarea", {
              onpaste: (e: ClipboardEvent) => {
                e.preventDefault();
                if (e.clipboardData !== null) {
                  badRows = badRows.concat(
                    e.clipboardData.getData("text").trim().split("\n")
                  );
                }
              },
              placeholder: "Paste JSONL or base 64 events here, one per line",
              rows: 1,
            }),
            m("p", ["Number of events to try to import: ", badRows.length]),
          ]),
          m(
            "footer.modal-card-foot",
            m(
              "button.button",
              {
                onclick: () => {
                  if (badRows.length) {
                    vnode.attrs.addRequests(badToRequests(badRows));
                    badRows = [];
                    vnode.attrs.setModal(undefined);
                  }
                },
              },
              "Import"
            )
          ),
        ]),
      ]
    ),
};
