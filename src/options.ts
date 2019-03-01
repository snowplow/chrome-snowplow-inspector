(() => {
    const tracking = document.getElementById('track') as HTMLInputElement;
    const repolist = document.getElementById('repos') as HTMLTextAreaElement;
    const schemalist = document.getElementById('schemas') as HTMLTextAreaElement;
    const stat = document.getElementById('status') as HTMLParagraphElement;
    const save = document.getElementById('save') as HTMLButtonElement;

    const showStoredSettings = () => {
        chrome.storage.sync.get({enableTracking: true, repolist: ['http://iglucentral.com']},
            (settings) => {
                tracking.checked = settings.enableTracking;
                repolist.value = settings.repolist.join('\n');
            },
        );
        chrome.storage.local.get({schemalist: []},
            (settings) => {
                schemalist.value = settings.schemalist.map((x: object) => JSON.stringify(x)).join('\n');
            },
        );
    };

    const parseMessyJson = (text: string) => {
        const lines = text.split('\n');

        const objects = [];

        let buffer = '';
        for (const line of lines) {
            let schema = null;

            buffer += line;

            try {
                schema = JSON.parse(buffer);
            } catch {
                continue;
            }

            buffer = '';

            if (schema !== null) {
                objects.push(schema);
            }
        }

        return objects;
    };

    const updateStoredSettings = () => {
        const repos = repolist.value.split(/\s*[\n,]\s*/)
                                    .map((x) => x.replace(/\n|\/+\s*$/g, ''))
                                    .filter((x) => !!x);

        const perms = {origins: repos.map((r) => '*://' + (new URL(r).hostname) + '/*')};

        chrome.storage.sync.set({
            enableTracking: tracking.checked,
            repolist: repos,
        }, () => {
            // We need to request permission to the iglu repos to avoid CORS
            chrome.permissions.request(perms);
            // Schemas can get quite large so store them locally only
            chrome.storage.local.set({
                schemalist: parseMessyJson(schemalist.value),
            }, () => {
                stat.textContent = 'Preferences Saved';
                setTimeout(() => stat.textContent = '', 1800);
                showStoredSettings();
            });
        });
    };

    showStoredSettings();
    save.addEventListener('click', updateStoredSettings, false);
})();
