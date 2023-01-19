(() => {
  const tracking = document.getElementById("track") as HTMLInputElement;
  const compactCore = document.getElementById(
    "compactCore"
  ) as HTMLInputElement;
  const tunnelAddress = document.getElementById(
    "tunnelAddress"
  ) as HTMLInputElement;
  const status = document.getElementById("status") as HTMLParagraphElement;
  const save = document.getElementById("save") as HTMLButtonElement;

  const showStoredSettings = () => {
    chrome.storage.sync.get(
      {
        enableTracking: true,
        compactCoreMetadata: false,
        tunnelAddress: "http://localhost:4040/",
      },
      (settings) => {
        tracking.checked = settings.enableTracking;
        compactCore.checked = settings.compactCoreMetadata;
        tunnelAddress.value = settings.tunnelAddress;
      }
    );
  };

  const updateStoredSettings = () => {
    chrome.storage.sync.set(
      {
        enableTracking: tracking.checked,
        compactCoreMetadata: compactCore.checked,
        tunnelAddress: tunnelAddress.value,
      },
      () => {
        status.textContent = "Preferences Saved";
        setTimeout(() => (status.textContent = ""), 1800);
        showStoredSettings();
      }
    );
  };

  showStoredSettings();
  save.addEventListener("click", updateStoredSettings, false);
})();
