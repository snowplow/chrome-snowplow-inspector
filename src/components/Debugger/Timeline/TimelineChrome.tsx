import type { Entry } from "har-format";
import { h, type FunctionComponent, type RefObject } from "preact";
import {
  type Dispatch,
  type StateUpdater,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "preact/hooks";
import { Ban, Download, Upload, Search } from "lucide-preact";

import type { IBeaconSummary, ITimeline } from "../../../ts/types";

import * as importers from "../importers";
import * as exporters from "../exporters";

export const TimelineChrome: FunctionComponent<{
  addRequests: (requests: Entry[]) => void;
  batchRef: RefObject<Entry[]>;
  clearRequests: () => void;
  filter: RegExp | undefined;
  filterStr: string;
  setFilterStr: Dispatch<StateUpdater<string>>;
  setModal: ITimeline["setModal"];
  summariesRef: RefObject<IBeaconSummary[][]>;
}> = ({
  addRequests,
  batchRef,
  children,
  clearRequests,
  filter,
  filterStr,
  setFilterStr,
  setModal,
  summariesRef,
}) => {
  const [streamLock, setStreamLock] = useState(-1);
  const [ngrokStreaming, setNgrokStreaming] = useState(false);

  const importHandler = useCallback(
    (format: importers.ImporterFormat) =>
      importers.importFromFormat(
        format,
        addRequests,
        setModal,
        { ngrokStreaming, setNgrokStreaming },
        { streamLock, setStreamLock },
      ),
    [addRequests, setModal, ngrokStreaming, streamLock],
  );

  useEffect(() => importHandler("ngrok"), [importHandler, ngrokStreaming]);

  const importHandlers = useMemo<Record<importers.ImporterFormat, () => void>>(
    () => ({
      bad: importHandler.bind(null, "bad"),
      ngrok: setNgrokStreaming.bind(null, (n) => !n),
      har: importHandler.bind(null, "har"),
      stream: importHandler.bind(null, "stream"),
    }),
    [importHandler],
  );

  const exportHandlers = useMemo<Record<exporters.ExporterFormat, () => void>>(
    () => ({
      csv() {
        return exporters.exportToFormat(
          "csv",
          batchRef.current!,
          summariesRef.current!,
        );
      },
      har() {
        return exporters.exportToFormat(
          "har",
          batchRef.current!,
          summariesRef.current!,
        );
      },
      json() {
        return exporters.exportToFormat(
          "json",
          batchRef.current!,
          summariesRef.current!,
        );
      },
    }),
    [batchRef, summariesRef],
  );
  return (
    <aside class="timeline min-w-[250px]">
      <fieldset class="timeline__controls">
        <legend>Event List Actions</legend>
        <div>
          <button
            class="icon_button"
            type="button"
            onClick={clearRequests}
            title="Clear Events"
          >
            <Ban />
          </button>
          <div class="vertical_divider"></div>
          <button
            class="icon_button"
            type="button"
            title="Import Events"
            popovertarget="importevents-po"
          >
            <Download />
          </button>
          <ul id="importevents-po" popover="auto">
            {Object.entries(importers.formats).map(([key, label]) => (
              <li
                value={key}
                onClick={importHandlers[key as importers.ImporterFormat]}
                role="button"
                tabindex={0}
              >
                {key == "ngrok" && ngrokStreaming ? `Stop ${label}` : label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            title="Export Events"
            popovertarget="exportevents-po"
            class="icon_button"
          >
            <Upload />
          </button>
          <ul id="exportevents-po" popover="auto">
            {Object.entries(exporters.formats).map(([key, label]) => (
              <li
                value={key}
                onClick={exportHandlers[key as exporters.ExporterFormat]}
                role="button"
                tabindex={0}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
        <label title="Search Events">
          <span>
            <Search class="search_icon" />
          </span>
          <input
            class={[filter ? "valid" : filterStr ? "invalid" : "valid"].join(
              " ",
            )}
            type="text"
            placeholder="Search Events"
            onKeyUp={(e) => {
              if (e.currentTarget instanceof HTMLInputElement) {
                setFilterStr(e.currentTarget.value);
              }
            }}
            value={filterStr}
          />
        </label>
      </fieldset>
      {children}
    </aside>
  );
};
