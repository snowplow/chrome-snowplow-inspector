import { h, render } from "preact";
import { useEffect, useState } from "preact/hooks";

import "./options.scss";

type StoredOptions = {
  enableTracking: boolean;
  tunnelAddress: string;
};

const Options = () => {
  const [options, setOptions] = useState<StoredOptions>({
    enableTracking: true,
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

  const handler = () => {
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
            [target.name]: target.value,
          }));
        }
      }}
      onSubmit={handler}
    >
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
        <input type="text" name="tunnelAddress" value={options.tunnelAddress} />
      </label>

      <p>{status}</p>
      <button>Save</button>
    </form>
  );
};

render(<Options />, document.body);
