declare global {
    var GlobalSnowplowNamespace: string[] | undefined;
    var snowplow: ((command: string, ..._: any) => void) & { q: IArguments[] };
}

window.GlobalSnowplowNamespace = window.GlobalSnowplowNamespace || ['snowplow'];
window.snowplow = window.snowplow || Object.assign(function() {snowplow.q.push(arguments); }, { q: [] });
snowplow('newTracker', 'sp', 'd.poplindata.com', {
    appId: 'snowplow-chrome-extension',
    platform: 'app',
});

const seenCollectors: {[collector: string]: string[]} = {};

const trackerAnalytics = (collector: string, pageUrl: string, appId: string) => {
    if (!pageUrl) {
        return;
    }
    collector = collector.toLowerCase();
    try {
        pageUrl = (new URL(pageUrl)).host.toLowerCase();
    } catch (e) {
        console.log(`Could not parse URL: ${pageUrl}`);
        return;
    }

    if (pageUrl === 'badbucket.invalid' || pageUrl === 'elasticsearch.invalid') {
        return;
    }

    appId = (appId || '').toLowerCase();

    const appKey = pageUrl + ':' + appId;

    if (!(collector in seenCollectors)) {
        seenCollectors[collector] = [];
    }

    if (!seenCollectors[collector].includes(appKey)) {
        seenCollectors[collector].push(appKey);

        chrome.storage.sync.get({ enableTracking: true }, (settings) => {
            if (settings.enableTracking) {
                snowplow('trackStructEvent', 'New Tracker', collector, pageUrl, appId);
            }
        });
    }
};

const repoAnalytics = (repo: string) => {
    if (repo !== 'http://iglucentral.com') {
        chrome.storage.sync.get({ enableTracking: true }, (settings) => {
            if (settings.enableTracking) {
                const repoUrl = new URL(repo);
                // Don't steal credentials if present
                repoUrl.username = '';
                repoUrl.password = '';

                snowplow('trackStructEvent', 'Custom Repo', 'Loaded', repoUrl.href);
            }
        });
    }
};

const landingUrl = 'https://poplindata.com/?' + [
    'utm_source=debugger%20extension',
    'utm_medium=software',
    'utm_campaign=Chrome%20extension%20debugger%20window%20top-left',
].join('&');

export = { trackerAnalytics, repoAnalytics, landingUrl };
