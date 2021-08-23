(() => {
  const tracking = document.getElementById("track") as HTMLInputElement;
  const stat = document.getElementById("status") as HTMLParagraphElement;
  const save = document.getElementById("save") as HTMLButtonElement;

  const showStoredSettings = () => {
    chrome.storage.sync.get({ enableTracking: true }, (settings) => {
      tracking.checked = settings.enableTracking;
    });
  };

  const updateStoredSettings = () => {
    chrome.storage.sync.set(
      {
        enableTracking: tracking.checked,
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
