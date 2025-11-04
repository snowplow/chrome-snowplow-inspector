import type { Entry } from "har-format";
import {
  h,
  type FunctionComponent,
  type MouseEventHandler,
  type RefObject,
} from "preact";
import {
  type Dispatch,
  type StateUpdater,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "preact/hooks";
import { Ban, Download, Ellipsis, Upload, Search } from "lucide-preact";

import type { DestinationManager } from "../../../ts/DestinationManager";
import type { Application, IBeaconSummary, ITimeline } from "../../../ts/types";

import * as importers from "../importers";
import {
  exportToFormat,
  formats as exportFormats,
  type ExporterFormat,
} from "../exporters";
import { CopyMenu } from "./CopyMenu";

const popoverHider =
  (inner: () => void): MouseEventHandler<HTMLElement> =>
  ({ currentTarget }) => {
    inner();
    const popover = currentTarget.closest<HTMLElement>("[popover]");
    popover?.hidePopover();
    document
      .querySelector<HTMLElement>(`[popovertarget="${popover?.id}"]`)
      ?.blur();
  };

export const TimelineChrome: FunctionComponent<{
  active?: IBeaconSummary;
  addRequests: (requests: Entry[]) => void;
  requests: Entry[];
  clearRequests: () => void;
  destinationManager: DestinationManager;
  filter: RegExp | undefined;
  filterStr: string;
  setFilterStr: Dispatch<StateUpdater<string>>;
  setApp: Dispatch<StateUpdater<Application>>;
  setModal: ITimeline["setModal"];
  summariesRef: RefObject<IBeaconSummary[][]>;
}> = ({
  active,
  addRequests,
  requests,
  children,
  clearRequests,
  destinationManager,
  filter,
  filterStr,
  setFilterStr,
  setApp,
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

  const importHandlers = useMemo<
    Record<importers.ImporterFormat, MouseEventHandler<HTMLElement>>
  >(
    () => ({
      bad: popoverHider(importHandler.bind(null, "bad")),
      ngrok: popoverHider(setNgrokStreaming.bind(null, (n) => !n)),
      har: popoverHider(importHandler.bind(null, "har")),
      stream: popoverHider(importHandler.bind(null, "stream")),
    }),
    [importHandler],
  );

  const exportHandlers = useMemo<
    Record<ExporterFormat, MouseEventHandler<HTMLElement>>
  >(
    () => ({
      csv: popoverHider(
        exportToFormat.bind(null, "csv", requests, summariesRef.current!),
      ),
      har: popoverHider(
        exportToFormat.bind(null, "har", requests, summariesRef.current!),
      ),
      json: popoverHider(
        exportToFormat.bind(null, "json", requests, summariesRef.current!),
      ),
    }),
    [requests, summariesRef],
  );
  return (
    <aside class="timeline">
      <fieldset class="timeline__controls">
        <legend>Event List Actions</legend>
        <div>
          <button
            class="icon_button"
            type="button"
            onClick={({ currentTarget }) => {
              clearRequests();
              currentTarget.blur();
            }}
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
              <li key={key}>
                <button
                  type="button"
                  onClick={importHandlers[key as importers.ImporterFormat]}
                >
                  {key == "ngrok" && ngrokStreaming ? `Stop ${label}` : label}
                </button>
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
            {Object.entries(exportFormats).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={exportHandlers[key as ExporterFormat]}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            title="More Options"
            popovertarget="moreoptions-po"
            class="icon_button"
          >
            <Ellipsis />
          </button>
          <ul id="moreoptions-po" popover="auto">
            <li>
              <button type="button" onClick={() => setApp("schemaManager")}>
                Manage Schemas
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setModal("destination", { destinationManager })}
              >
                Change Destination
              </button>
            </li>
            {active && <CopyMenu beacon={active} />}
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
