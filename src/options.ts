(() => {
    const tracking = document.getElementById('track') as HTMLInputElement;
    const repolist = document.getElementById('repos') as HTMLTextAreaElement;
    const stat = document.getElementById('status') as HTMLParagraphElement;
    const save = document.getElementById('save') as HTMLButtonElement;

    const showStoredSettings = () => {
        chrome.storage.sync.get({enableTracking: true, repolist: ['http://iglucentral.com']}, (settings) => {
            console.log(settings);

            tracking.checked = settings.enableTracking;
            repolist.value = settings.repolist.join('\n');
        });
    };

    const updateStoredSettings = () => {
        chrome.storage.sync.set({
            enableTracking: tracking.checked,
            repolist: repolist.value.split(/\s*[\n,]\s*/)
                                    .map((x) => x.replace(/\n|\/+\s*$/g, ''))
                                    .filter((x) => !!x),
        }, () => {
            stat.textContent = 'Preferences Saved';
            setTimeout(() => stat.textContent = '', 1800);
            showStoredSettings();
        });
    };

    showStoredSettings();
    save.addEventListener('click', updateStoredSettings, false);
})();
