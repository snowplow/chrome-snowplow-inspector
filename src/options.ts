const showStoredSettings = () => {
    chrome.storage.sync.get({enableTracking: true}, (settings) => {
        (document.getElementById('track') as HTMLInputElement).checked = settings.enableTracking;
    });
};

const updateStoredSettings = () => {
    chrome.storage.sync.set({enableTracking: (document.getElementById('track') as HTMLInputElement).checked}, () => {
        document.getElementById('status').textContent = 'Preferences Saved';
        setTimeout(() => document.getElementById('status').textContent = '', 1800);
    });
};

showStoredSettings();
document.getElementById('save').addEventListener('click', updateStoredSettings, false);
