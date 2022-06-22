import { Entry } from "har-format";
import { h, FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { badToRequests } from "../../ts/util";
import { ModalOptions } from ".";

export interface BadRowsOptions extends ModalOptions {
  addRequests: (reqs: Entry[]) => void;
}

export const BadRows: FunctionComponent<BadRowsOptions> = ({
  addRequests,
  setModal,
}) => {
  const [badRows, setBadRows] = useState<string[]>([]);
  return (
    <div class="modal is-active">
      <div class="modal-background" onClick={() => setModal()}></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Bad Rows Import</p>
          <button class="delete" onClick={() => setModal()} />
        </header>
        <section class="modal-card-body">
          <p>
            Bad Rows occur when events fail to validate during enrichment. You
            can paste your bad data straight from S3 (1 JSON object per line),
            or, for real-time data, the JSON object from the _source field in
            ElasticSearch or just the line property of that object. Keep pasting
            to include events in bulk. Invalid payloads (OPTIONS requests, no
            data, invalid JSON, bots, etc.) will be ignored.
          </p>
          <textarea
            class="textarea"
            placeholder="Paste JSONL or base 64 events here, one per line"
            rows={1}
            onPaste={(e: ClipboardEvent) => {
              e.preventDefault();
              setBadRows((badRows) => {
                if (e.clipboardData !== null) {
                  return badRows.concat(
                    e.clipboardData.getData("text").trim().split("\n")
                  );
                } else return badRows;
              });
            }}
          />
          <p>Number of events to the to import: {badRows.length}</p>
        </section>
        <footer class="modal-card-foot">
          <button
            class="button"
            onClick={() => {
              if (badRows.length) {
                addRequests(badToRequests(badRows));
                setBadRows([]);
                setModal();
              }
            }}
          >
            Import
          </button>
        </footer>
      </div>
    </div>
  );
};
