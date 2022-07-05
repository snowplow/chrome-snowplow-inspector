import { Entry } from "har-format";
import { h, FunctionComponent } from "preact";
import { useCallback, useState } from "preact/hooks";

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

  const onImport = useCallback((e: ClipboardEvent | DragEvent) => {
    e.preventDefault();
    const transfer = "clipboardData" in e ? e.clipboardData : e.dataTransfer;

    if (transfer !== null) {
      if (transfer.files.length) {
        Promise.all(
          Array.from(transfer.files).map((file) =>
            file.text().then((text) => text.split("\n"))
          )
        ).then((inputs) =>
          setBadRows((badRows) => badRows.concat(inputs.flat()))
        );
      } else {
        setBadRows((badRows) =>
          badRows.concat(transfer.getData("text").trim().split("\n"))
        );
      }
    }
  }, []);

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
            can paste your bad data straight from S3 (1 JSON object per line, or
            an entire file with that format). For real-time data, the JSON
            object from the <code>_source</code> field in ElasticSearch or just
            the <code>line</code> property of that object. Keep pasting to
            include events in bulk. Invalid payloads (OPTIONS requests, no data,
            invalid JSON, bots, etc.) will be ignored.
          </p>
          <textarea
            class="textarea"
            placeholder="Paste JSONL or base 64 events here, one per line"
            rows={1}
            onDrop={onImport}
            onPaste={onImport}
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
