import { h, type FunctionComponent } from "preact";
import {
  useEffect,
  useErrorBoundary,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type StateUpdater,
} from "preact/hooks";
import { RefreshCw, Search } from "lucide-preact";
import type { MutableRefObject } from "preact/compat";

import { errorAnalytics } from "../../ts/analytics";
import { enrichedFieldLabel } from "../../ts/protocol";
import type { OAuthResult, SignalsInstall } from "../../ts/types";
import { formatDuration } from "../../ts/util";

import { Brochure } from "./Brochure";
import { formatError, isUnauthorized } from "./errors";
import { isColumnHeader, isEmptyBuffer, withoutPrompt } from "./narrative";
import type {
  AgenticContextDefinition,
  SignalsClient,
  SignalsDefinition,
} from "./SignalsClient";

type NarrativeResult =
  | { identifier: string; narrative: string }
  | { identifier: string; error: unknown };

/**
 * Buffers age events out and narratives quote elapsed times, so a context goes
 * stale on its own without any new events being tracked.
 */
const POLL_INTERVAL_MS = 2000;

const Narrative: FunctionComponent<{ text: string }> = ({ text }) => {
  const lines = useMemo(
    () =>
      isEmptyBuffer(text)
        ? undefined
        : text
            .split("\n")
            .map((line) => ({ line, header: isColumnHeader(line) })),
    [text],
  );

  if (!lines) return <p class="narrative__empty">No available events</p>;

  return (
    <div class="narrative">
      {lines.map(({ line, header }, i) => (
        <div key={i} class={header ? "narrative__header" : undefined}>
          {line || " "}
        </div>
      ))}
    </div>
  );
};

const Identifier: FunctionComponent<{
  attributeKey: string;
  value: string;
}> = ({ attributeKey, value }) => (
  // spaces itself, so it reads the same in a figcaption and in a table cell
  <span class="identifier-pair">
    <span>{enrichedFieldLabel(attributeKey)}</span>
    <span class="identifier">{value}</span>
  </span>
);

const AgenticContextData: FunctionComponent<{
  client: SignalsClient;
  definition: AgenticContextDefinition;
  identifiers: Record<string, Set<string>>;
  includeInstance: boolean;
  orgName: string;
  label: string;
  refresh: number;
  filter?: string | RegExp;
  unauthorizedClients: MutableRefObject<Set<SignalsClient>>;
}> = ({
  client,
  definition,
  identifiers,
  includeInstance,
  orgName,
  label,
  refresh,
  filter,
  unauthorizedClients,
}) => {
  useErrorBoundary(errorAnalytics);

  const { name, version, prompt, attribute_key, max_events, max_age_seconds } =
    definition;
  const [results, setResults] = useState<(NarrativeResult | undefined)[]>([]);

  // the panel only learns identifiers by observing them in tracked events
  const identifierCount = identifiers[attribute_key.name]?.size ?? 0;

  useEffect(() => {
    let cancelled = false;
    const ids = [...(identifiers[attribute_key.name] ?? [])];

    if (unauthorizedClients.current.has(client)) return;

    const fetchForIdentifier = (identifier: string, i: number) =>
      client
        .getAgenticContext({ name, identifier, format: "narrative" })
        .then(
          // strip the echoed prompt once, rather than on every render
          (narrative): NarrativeResult => ({
            identifier,
            narrative: withoutPrompt(narrative, prompt),
          }),
          (error): NarrativeResult => {
            // an empty buffer still answers 200, so every error is worth
            // showing: a 404 means the event log is no longer published, or
            // isn't keyed on the identifiers we are asking with
            if (isUnauthorized(error)) unauthorizedClients.current.add(client);

            return { identifier, error };
          },
        )
        .then((result) => {
          // show each narrative as it lands, rather than waiting for its batch
          if (cancelled) return;
          setResults((current) => {
            const updated = [...current];
            updated[i] = result;
            return updated;
          });
        });

    // identifiers accumulate for the life of the panel, so cap concurrency
    const fetchNarratives = async () => {
      const batchSize = 10;

      for (let i = 0; i < ids.length; i += batchSize) {
        if (cancelled || unauthorizedClients.current.has(client)) break;

        await Promise.all(
          ids
            .slice(i, i + batchSize)
            .map((identifier, offset) =>
              fetchForIdentifier(identifier, i + offset),
            ),
        );
      }
    };

    // each pass is scheduled only once the last one finishes, so slow responses
    // cannot pile up on top of each other
    let timeout = setTimeout(async function poll() {
      await fetchNarratives();
      if (!cancelled) timeout = setTimeout(poll, POLL_INTERVAL_MS);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [identifiers, refresh]);

  const matches = (haystack: string) => {
    if (!filter) return true;
    return typeof filter === "string"
      ? haystack.toLowerCase().includes(filter.toLowerCase())
      : filter.test(haystack);
  };

  const nameMatches = matches(name);

  const visible = results.filter(
    (result): result is NarrativeResult =>
      !!result &&
      (nameMatches ||
        matches(result.identifier) ||
        matches(
          "error" in result ? formatError(result.error) : result.narrative,
        )),
  );

  // a search that matches nothing here hides the definition; otherwise it stays
  // visible so you can see what is configured, with why there is no data yet
  if (filter && !visible.length && !nameMatches) return null;

  return (
    <details open>
      <summary key="summary">
        <span class="groupname">{name}</span>
        {includeInstance && <span class="groupinstance">{orgName}</span>}
        <span class="grouplabel">{label}</span>
        <span class="groupversion">v{version}</span>
        <span class="groupsource">
          Max {max_events} events / {formatDuration(max_age_seconds)} retention
        </span>
      </summary>
      {prompt ? (
        <figure class="agentic" key="prompt">
          <figcaption>Prompt</figcaption>
          <p>{prompt}</p>
        </figure>
      ) : null}
      {visible.map((result) =>
        "error" in result ? (
          <table key={result.identifier}>
            <tbody>
              <tr>
                <th>
                  <Identifier
                    attributeKey={attribute_key.name}
                    value={result.identifier}
                  />
                </th>
                <td>
                  {isUnauthorized(result.error) ? (
                    <button
                      type="button"
                      onClick={() => chrome.runtime.openOptionsPage()}
                    >
                      Click here to set an API key to access agentic contexts
                    </button>
                  ) : (
                    <span>{formatError(result.error)}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <figure class="agentic" key={result.identifier}>
            <figcaption>
              <Identifier
                attributeKey={attribute_key.name}
                value={result.identifier}
              />
            </figcaption>
            <Narrative text={result.narrative} />
          </figure>
        ),
      )}
      {!visible.length && (
        <p class="narrative__empty">
          {identifierCount
            ? "Loading context…"
            : "No session observed yet. Interact with the page to record an event, then its context appears here."}
        </p>
      )}
    </details>
  );
};

const AgenticContextsUI: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: (SignalsDefinition | undefined)[];
}> = ({ attributeKeyIds, signalsDefs }) => {
  const unauthorizedClients = useRef(new Set<SignalsClient>());
  const [filter, setFilter] = useState("");
  const [refresh, setRefresh] = useState(0);

  let pattern: string | RegExp = filter;
  try {
    pattern = pattern && new RegExp(pattern, "i");
  } catch (_) {}

  const installs = signalsDefs.filter(
    (def): def is SignalsDefinition => !!def && !!def.agenticContexts.length,
  );

  // an entry is undefined until its registry fetch settles, and the array is
  // empty until the clients exist at all: either way we don't know yet
  const loading = !signalsDefs.length || signalsDefs.some((def) => !def);

  return (
    <article>
      <div class="attribute-group-controls">
        <label key="search" title="Search Agentic Contexts">
          <span>
            <Search />
          </span>
          <input
            type="text"
            placeholder="Search Agentic Contexts"
            onKeyUp={(e) => {
              if (e.currentTarget instanceof HTMLInputElement) {
                setFilter(e.currentTarget.value);
              }
            }}
            value={filter}
          />
        </label>
        <label key="refresh" title="Refresh agentic contexts">
          <button type="button" onClick={() => setRefresh((r) => r + 1)}>
            <RefreshCw />
          </button>
        </label>
      </div>
      {installs.length ? (
        installs.map(({ client, info, agenticContexts }) =>
          agenticContexts.map((definition) => (
            <AgenticContextData
              key={`${client.baseUrl}.${definition.name}`}
              client={client}
              definition={definition}
              identifiers={attributeKeyIds}
              includeInstance={installs.length > 1}
              orgName={info.orgName}
              label={info.label}
              refresh={refresh}
              filter={pattern}
              unauthorizedClients={unauthorizedClients}
            />
          )),
        )
      ) : loading ? (
        <p>Looking for agentic contexts&hellip;</p>
      ) : (
        <p>
          No published agentic contexts were found for the connected Signals
          installs.
        </p>
      )}
    </article>
  );
};

export const AgenticContexts: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  login?: OAuthResult;
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
  signalsDefs: (SignalsDefinition | undefined)[];
  signalsInfo: Record<string, SignalsInstall[]>;
}> = ({ attributeKeyIds, login, setLogin, signalsDefs, signalsInfo }) => {
  useErrorBoundary(errorAnalytics);
  const signalsAvailable = Object.keys(signalsInfo).length > 0;

  return (
    <main key="app" class="app app--agentic-contexts agentic-contexts">
      {signalsAvailable ? (
        <AgenticContextsUI
          attributeKeyIds={attributeKeyIds}
          signalsDefs={signalsDefs}
        />
      ) : (
        <Brochure login={login} setLogin={setLogin} />
      )}
    </main>
  );
};
