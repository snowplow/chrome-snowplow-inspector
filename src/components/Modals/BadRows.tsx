import type { Entry } from "har-format";
import { h, type FunctionComponent } from "preact";
import { useCallback, useState } from "preact/hooks";

import { badToRequests } from "../../ts/util";
import type { ModalOptions } from ".";
import { BaseModal } from "./BaseModal";

export interface BadRowsOptions extends ModalOptions {
  addRequests: (reqs: Entry[]) => void;
}

const mergeJsonLines = (lines: string[]) => {
  const jsonl: string[] = [];

  let buffer: string | null = null;
  for (let line of lines) {
    line = line.trim();

    if (!line) continue;

    if (buffer === null && line.startsWith("{")) {
      buffer = "";
    }

    if (buffer !== null) {
      buffer += line;
      try {
        JSON.parse(buffer);
        jsonl.push(buffer);
        buffer = null;
      } catch {}
    } else {
      jsonl.push(line);
    }
  }

  if (buffer) jsonl.push(buffer);

  return jsonl;
};

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
            file.text().then((text) => mergeJsonLines(text.split("\n"))),
          ),
        ).then((inputs) =>
          setBadRows((badRows) => badRows.concat(inputs.flat())),
        );
      } else {
        setBadRows((badRows) =>
          badRows.concat(
            mergeJsonLines(transfer.getData("text").trim().split("\n")),
          ),
        );
      }
    }
  }, []);

  const onSubmit = useCallback(() => {
    if (badRows.length) {
      addRequests(badToRequests(badRows));
      setBadRows([]);
      setModal();
    }
  }, [badRows, setModal, addRequests, badToRequests]);

  return (
    <BaseModal title="Bad Rows Import" onClose={setModal} onSubmit={onSubmit}>
      <section>
        <p>
          Bad Rows occur when events fail to validate during enrichment. You can
          paste your bad data straight from S3 (1 JSON object per line, or an
          entire file with that format). For real-time data, the JSON object
          from the <code>_source</code> field in ElasticSearch or just the{" "}
          <code>line</code> property of that object. Keep pasting to include
          events in bulk. Invalid payloads (OPTIONS requests, no data, invalid
          JSON, bots, etc.) will be ignored.
        </p>
        <textarea
          class="textarea"
          placeholder="Paste JSONL or base 64 events here, one per line"
          rows={1}
          onDrop={onImport}
          onPaste={onImport}
        />
        <p>Number of events to import: {badRows.length}</p>
      </section>
      <footer>
        <button>Import</button>
      </footer>
    </BaseModal>
  );
};
