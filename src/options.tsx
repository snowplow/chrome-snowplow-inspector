import { h, render } from "preact";
import { useEffect, useState } from "preact/hooks";

import "./options.css";

export type StoredOptions = {
  enableTracking: boolean;
  signalsSandboxToken: string;
  signalsSandboxUrl: string;
  signalsApiKeys: { org: string; apiKey: string; apiKeyId: string }[];
  tunnelAddress: string;
};

const SAMPLE_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN =
  "^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$";

const Options = () => {
  const [options, setOptions] = useState<StoredOptions>({
    enableTracking: true,
    signalsSandboxToken: "",
    signalsSandboxUrl: "",
    signalsApiKeys: [],
    tunnelAddress: "http://localhost:4040/",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    chrome.storage.sync.get(options, (opts) =>
      setOptions(opts as StoredOptions),
    );
  }, []);

  useEffect(() => {
    const tid = setTimeout(() => setStatus(""), 1800);
    return () => clearTimeout(tid);
  }, [status]);

  const handler = (e: Event) => {
    e.preventDefault();
    if (
      e.currentTarget instanceof HTMLFormElement &&
      e.currentTarget.reportValidity()
    ) {
      const validated = {
        ...options,
        signalsApiKeys: options.signalsApiKeys.filter(
          ({ org, apiKey, apiKeyId }) => !!(org && apiKey && apiKeyId),
        ),
      };
      chrome.storage.sync.set(validated, () => {
        setStatus("Preferences Saved");
      });
    }
  };

  return (
    <form
      onChange={({ target }) => {
        if (target instanceof HTMLInputElement) {
          const apiKeyIndex = parseInt(target.dataset.apiKeyIndex || "", 10);
          if (!Number.isNaN(apiKeyIndex)) {
            const info = options.signalsApiKeys[apiKeyIndex] ?? {
              org: "",
              apiKey: "",
              apiKeyId: "",
            };
            info[target.name as keyof typeof info] = target.value;
            const signalsApiKeys = [...options.signalsApiKeys];
            signalsApiKeys[apiKeyIndex] = info;

            setOptions((options) => ({
              ...options,
              signalsApiKeys,
            }));
          } else {
            setOptions((options) => ({
              ...options,
              [target.name]: target.checked ?? target.value,
            }));
          }
        }
      }}
      onSubmit={handler}
    >
      <h1>Snowplow Inspector Options</h1>
      <fieldset>
        <label>
          <input
            type="checkbox"
            name="enableTracking"
            checked={options.enableTracking}
          />
          Send anonymous usage information
        </label>

        <label>
          Ngrok tunnel address
          <input
            type="text"
            name="tunnelAddress"
            value={options.tunnelAddress}
          />
        </label>
        <fieldset>
          <legend>Signals</legend>
          <fieldset>
            <legend>Sandbox</legend>
            <label>
              Signals Sandbox URL
              <input
                type="text"
                name="signalsSandboxUrl"
                value={options.signalsSandboxUrl}
              />
            </label>

            <label>
              Signals Sandbox Token
              <input
                type="text"
                name="signalsSandboxToken"
                value={options.signalsSandboxToken}
                required={!!options.signalsSandboxUrl}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>API Keys</legend>
            {options.signalsApiKeys
              .concat({ org: "", apiKey: "", apiKeyId: "" })
              .map(({ org, apiKey, apiKeyId }, i) => (
                <fieldset>
                  <label>
                    Organization ID
                    <input
                      type="text"
                      name="org"
                      data-api-key-index={i}
                      pattern={UUID_PATTERN}
                      placeholder={SAMPLE_UUID}
                      value={org}
                      required={!!(org || apiKey || apiKeyId)}
                    />
                  </label>
                  {/^[0-9a-f-]{36}$/i.test(org) && !(apiKey && apiKeyId) ? (
                    <a
                      href={`https://console.snowplowanalytics.com/${org}/credentials`}
                      target="_blank"
                    >
                      Generate an API key pair
                    </a>
                  ) : null}
                  <label>
                    API Key ID
                    <input
                      type="text"
                      name="apiKeyId"
                      data-api-key-index={i}
                      pattern={UUID_PATTERN}
                      placeholder={SAMPLE_UUID}
                      value={apiKeyId}
                      required={!!(org || apiKey || apiKeyId)}
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      type="text"
                      name="apiKey"
                      data-api-key-index={i}
                      pattern={UUID_PATTERN}
                      placeholder={SAMPLE_UUID}
                      value={apiKey}
                      required={!!(org || apiKey || apiKeyId)}
                    />
                  </label>
                </fieldset>
              ))}
          </fieldset>
        </fieldset>

        {status ? <p>{status}</p> : <button>Save</button>}
      </fieldset>
    </form>
  );
};

render(<Options />, document.body);
