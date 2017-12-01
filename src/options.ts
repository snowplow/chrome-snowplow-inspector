function showStoredSettings() {
    chrome.storage.sync.get({enableTracking: true}, (settings) => {
        (<HTMLInputElement>document.getElementById('track')).checked = settings.enableTracking;
    });
}

function updateStoredSettings() {
    chrome.storage.sync.set({enableTracking: (<HTMLInputElement>document.getElementById('track')).checked}, () => {
        document.getElementById('status').textContent = 'Preferences Saved';
        setTimeout(function(){document.getElementById('status').textContent = '';}, 1800);
    });
}


showStoredSettings();
document.getElementById('save').addEventListener('click', updateStoredSettings, false);
