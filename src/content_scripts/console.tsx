import { buildRegistry } from "../ts/iglu";

const RECHECK_INTERVAL_MS = 100;

let organizationId: string | null = null;
let existingConfig = false;

const updatePage = () => {
  const button = document.querySelector<HTMLButtonElement>(
    "[data-testid=currentUserButton]"
  );
  if (!button) return;

  if (
    /\/credentials/.test(location.pathname) &&
    sessionStorage.getItem("snowplowInspectorImport") === "true"
  ) {
    const apiKeyElement = document.querySelector("pre");
    if (!apiKeyElement) {
      const input = document.getElementById("name");
      if (input instanceof HTMLInputElement) {
        if (!input.value) {
          // https://hustle.bizongo.in/simulate-react-on-change-on-controlled-components-baa336920e04
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, "Snowplow Inspector");
            input.dispatchEvent(new Event('input', { bubbles: true}));
          }
        }
      }
    } else {
      const apiKey = apiKeyElement.textContent ?? "";
      console.log("found api key", apiKey);
      if (/^[0-9a-f-]{36}$/.test(apiKey)) {
        clearInterval(intervalId);

        let name = "Snowplow Console";
        const nameElement = document.querySelector("#organization-select, h1");

        if (nameElement) {
          if (nameElement instanceof HTMLInputElement) {
            name = nameElement.value || name;
          } else {
            name = nameElement.textContent || name;
          }
        }

        name = `BDP: ${name}`;

        const reg = buildRegistry({ kind: "ds", name, organizationId, apiKey });

        if (
          window.confirm(
            `Snowplow Console API Key Generated! Import this Data Structures API registry (${name}) into Snowplow Inspector?`
          )
        ) {
          chrome.storage.sync.get({ registries: [] }, ({ registries }) => {
            registries.push(JSON.stringify(reg));
            chrome.storage.sync.set({ registries }, () =>
              window.alert(
                "Registry imported. Schemas from this registry should now be viewable in Snowplow Inspector and used for Event validation."
              )
            );
          });
        }
      }
    }
  } else {
    const badgeContainer = button.parentNode;
    if (!badgeContainer) return;

    const cloneTarget = badgeContainer.firstElementChild!;
    if (cloneTarget.classList.contains("added-by-extension")) {
      return;
    }

    const clone = cloneTarget.cloneNode(true);

    if (clone instanceof HTMLDivElement) {
      sessionStorage.setItem("snowplowInspectorImport", "false");
      clone.classList.add("added-by-extension");
      const button = clone.querySelector("button");
      if (button) {
        const tn = document.createTextNode("Import into Snowplow Inspector");
        button.replaceChild(tn, button.lastChild!);
        button.type = "button";
        button.addEventListener(
          "click",
          () => {
            sessionStorage.setItem("snowplowInspectorImport", "true");
            location.replace("credentials");
          },
          false
        );

        badgeContainer.insertBefore(clone, cloneTarget);
      }
    }
  }
};

const intervalId = setInterval(() => {
  const latestOrg = location.pathname.split("/")[1];

  if (organizationId !== latestOrg) {
    if (organizationId)
      sessionStorage.setItem("snowplowInspectorImport", "false");
    organizationId = latestOrg;
    chrome.storage.sync.get({ registries: [] }, ({ registries }) => {
      for (const repo of registries as string[]) {
        const reg = buildRegistry(JSON.parse(repo));

        if (reg.spec.kind === "ds") {
          const orgId = reg.opts.organizationId;

          if (latestOrg === orgId) {
            console.log("Found matching extension repository", reg);
            existingConfig = true;
            return;
          }
        }
      }

      console.log("No matching extension repository found", latestOrg);
      existingConfig = false;
      organizationId = latestOrg;
    });
  } else if (!existingConfig) {
    updatePage();
  }
}, RECHECK_INTERVAL_MS);
