import { h, render } from "preact";
import { useEffect, useState } from "preact/hooks";

import "./options.css";

import { utmify } from "./ts/analytics";

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
const UUID_DESCRIPTION = "Must be a valid UUID";

const Options = () => {
  const [options, setOptions] = useState<StoredOptions>({
    enableTracking: true,
    signalsSandboxToken: "",
    signalsSandboxUrl: "",
    signalsApiKeys: [],
    tunnelAddress: "http://localhost:4040/",
  });
  const [status, setStatus] = useState("");

  useEffect(() => chrome.storage.sync.get(options, setOptions), []);

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

            if (
              signalsApiKeys.find(
                ({ org }, i) => i !== apiKeyIndex && org === info.org,
              )
            ) {
              target.setCustomValidity(
                "Duplicate API credentials for this organization",
              );
            } else {
              target.setCustomValidity("");
            }

            if (
              signalsApiKeys.find(
                ({ apiKeyId, org }, i) =>
                  i !== apiKeyIndex &&
                  apiKeyId === info.apiKeyId &&
                  org === info.org,
              )
            ) {
              target.setCustomValidity(
                "Duplicate API Key ID values found for this organization",
              );
            } else {
              target.setCustomValidity("");
            }

            setOptions((options) => ({
              ...options,
              signalsApiKeys,
            }));
          } else {
            setOptions((options) => ({
              ...options,
              [target.name]:
                target.type === "checkbox" ? target.checked : target.value,
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

        <fieldset>
          <legend>Signals</legend>
          <p>
            For security reasons, only{" "}
            <abbr title="Machine to Machine">M2M</abbr>
            access tokens can access the attribute data stored in your Signals
            instance - <em>not</em> the access token provided when you log into
            Console. M2M tokens are obtained using API keys{" "}
            <a
              href="https://console.snowplowanalytics.com/credentials"
              target="_blank"
            >
              generated in Console
            </a>
            . Here you can define API keys to use for each Organization ID you
            want to access Attributes data for.
          </p>
          <p>
            <a href={utmify("https://snowplow.io/signals")} target="_blank">
              Find out more about Signals
            </a>
            , or{" "}
            <a
              href={utmify("https://docs.snowplow.io/docs/signals")}
              target="_blank"
            >
              view the documentation.
            </a>
          </p>
          <fieldset>
            <legend>API Keys</legend>
            <div>
              {options.signalsApiKeys.map(({ org, apiKey, apiKeyId }, i) => (
                <fieldset key={i}>
                  <label>
                    Organization ID
                    <input
                      type="text"
                      name="org"
                      data-api-key-index={i}
                      title={UUID_DESCRIPTION}
                      pattern={UUID_PATTERN}
                      placeholder={SAMPLE_UUID}
                      value={org}
                      required
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
                      title={UUID_DESCRIPTION}
                      pattern={UUID_PATTERN}
                      placeholder={SAMPLE_UUID}
                      value={apiKeyId}
                      required
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      type="text"
                      name="apiKey"
                      data-api-key-index={i}
                      title={UUID_DESCRIPTION}
                      pattern={UUID_PATTERN}
                      placeholder={SAMPLE_UUID}
                      value={apiKey}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions(({ signalsApiKeys, ...opts }) => ({
                        ...opts,
                        signalsApiKeys: signalsApiKeys.filter(
                          (_, index) => index !== i,
                        ),
                      }))
                    }
                  >
                    Remove organization
                  </button>
                </fieldset>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setOptions(({ signalsApiKeys, ...opts }) => ({
                  ...opts,
                  signalsApiKeys: signalsApiKeys.concat({
                    org: "",
                    apiKey: "",
                    apiKeyId: "",
                  }),
                }))
              }
            >
              Add new organization
            </button>
          </fieldset>
        </fieldset>
        <fieldset>
          <legend>Signals Sandbox</legend>
          <p>
            If you're{" "}
            <a href={utmify("https://try-signals.snowplow.io/")}>
              trialing Signals
            </a>
            , you can enter details of your sandbox environment here.
          </p>
          <label>
            Profiles API URL
            <input
              type="text"
              name="signalsSandboxUrl"
              title="Profiles API hostname only without path"
              pattern="(https?:\/\/)?[^\/:]+(:[0-9]+)?"
              placeholder="00000000-0000-0000-0000-000000000000.svc.snplow.net"
              value={options.signalsSandboxUrl}
            />
          </label>

          <label>
            Sandbox Token
            <input
              type="text"
              name="signalsSandboxToken"
              title={UUID_DESCRIPTION}
              pattern={UUID_PATTERN}
              placeholder={SAMPLE_UUID}
              value={options.signalsSandboxToken}
              required={!!options.signalsSandboxUrl}
            />
          </label>
        </fieldset>
        <label>
          Ngrok tunnel address
          <input
            type="text"
            name="tunnelAddress"
            value={options.tunnelAddress}
          />
        </label>
        {status ? <p class="status">{status}</p> : <button>Save</button>}
      </fieldset>
    </form>
  );
};

render(<Options />, document.body);
