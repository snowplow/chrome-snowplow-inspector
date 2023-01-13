(() => {
  const tracking = document.getElementById("track") as HTMLInputElement;
  const ngrokTunnelAddress = document.getElementById(
    "ngrokTunnelAddress"
  ) as HTMLInputElement;
  const stat = document.getElementById("status") as HTMLParagraphElement;
  const save = document.getElementById("save") as HTMLButtonElement;

  const showStoredSettings = () => {
    chrome.storage.sync.get(
      {
        enableTracking: true,
        ngrokTunnelAddress: "http://localhost:4040/",
      },
      (settings) => {
        tracking.checked = settings.enableTracking;
        ngrokTunnelAddress.value = settings.ngrokTunnelAddress;
      }
    );
  };

  const updateStoredSettings = () => {
    chrome.storage.sync.set(
      {
        enableTracking: tracking.checked,
        ngrokTunnelAddress: ngrokTunnelAddress.value,
      },
      () => {
        stat.textContent = "Preferences Saved";
        setTimeout(() => (stat.textContent = ""), 1800);
        showStoredSettings();
      }
    );
  };

  showStoredSettings();
  save.addEventListener("click", updateStoredSettings, false);
})();
