import { h, render } from "preact";
import { useEffect, useState } from "preact/hooks";

import "./options.scss";

type StoredOptions = {
  enableTracking: boolean;
  hideTestSuites: boolean;
  tunnelAddress: string;
};

const Options = () => {
  const [options, setOptions] = useState<StoredOptions>({
    enableTracking: true,
    hideTestSuites: false,
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
    chrome.storage.sync.set(options, () => {
      setStatus("Preferences Saved");
    });
  };

  return (
    <form
      onChange={({ target }) => {
        if (target instanceof HTMLInputElement) {
          setOptions((options) => ({
            ...options,
            [target.name]: target.checked ?? target.value,
          }));
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
          <input
            type="checkbox"
            name="hideTestSuites"
            checked={options.hideTestSuites}
          />
          Hide the Test Suites panel
        </label>

        <label>
          Ngrok tunnel address
          <input
            type="text"
            name="tunnelAddress"
            value={options.tunnelAddress}
          />
        </label>

        {status ? <p>{status}</p> : <button>Save</button>}
      </fieldset>
    </form>
  );
};

render(<Options />, document.body);
