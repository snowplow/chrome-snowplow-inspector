import jsonschema = require('jsonschema');
import m = require('mithril');
import analytics = require('./analytics');

const cache = {};
const status = {};
const jsv = new jsonschema.Validator();
const repositories = new Set();

/* tslint:disable:max-line-length */
const STRICT_SCHEMA_PATTERN = /^iglu:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/([1-9][0-9]*(?:-(?:0|[1-9][0-9]*)){2})()$/;
const LAX_SCHEMA_PATTERN = /^iglu:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/([0-9]*(?:-(?:0|[1-9][0-9]*)){2})(.*)$/;

const syncRepos = () => {
    repositories.clear();
    for (const p in status) {
        if (status[p] === null) {
            delete status[p];
        }
    }

    chrome.storage.sync.get({repolist: ['http://iglucentral.com']}, (settings) => {
        for (const repo of settings.repolist) {
            repositories.add(repo);
            analytics.repoAnalytics(repo);
        }
    });
};

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && 'repolist' in changes) {
        syncRepos();
    }
});

syncRepos();

const persistCache = (key, value, url) => {
    cache[key] = value;
    status[key] = url;
    chrome.storage.local.set({schemacache: cache, schemastatus: status});
};

chrome.storage.local.get({schemacache: {}, schemastatus: {}}, (settings) => {
    for (const key in settings.schemacache) {
        if (settings.schemacache.hasOwnProperty(key)) {
            cache[key] = settings.schemacache[key];
        }
    }
    for (const key in settings.schemastatus) {
        if (settings.schemastatus.hasOwnProperty(key) && settings.schemastatus[key] !== null) {
            status[key] = settings.schemastatus[key];
        }
    }
});

export = {
    validate: (schema, data) => {
        const strictMatch = STRICT_SCHEMA_PATTERN.exec(schema);
        const laxMatch = LAX_SCHEMA_PATTERN.exec(schema);

        if (!strictMatch && !laxMatch) {
            return {valid: false, errors: ['Invalid Iglu URI identifying schema.'], location: null};
        }

        if (schema in cache) {
            const result = jsv.validate(data, cache[schema]) as any;
            result.location = status[schema];
            if (!strictMatch && laxMatch) {
                result.errors.push('Iglu URI does not match the spec and may not validate during enrichment.', `Iglu URI: ${result.location}`);
            }
            return result;
        }

        const [evendor, ename, eformat, eversion, etag] = strictMatch ? strictMatch.slice(1) : laxMatch.slice(1);

        if (!(schema in status)) {
            status[schema] = null;

            for (const repo of Array.from(repositories)) {
                const url = [repo, 'schemas', evendor, ename, eformat, eversion + etag].join('/');

                m.request(url).then((schemaJson) => {
                    if (schemaJson.hasOwnProperty('self')) {
                        const {vendor, name, format, version} = (schemaJson as any).self;
                        if (evendor === vendor && ename === name && eformat === format && (eversion === version || eversion + etag === version)) {
                            persistCache(schema, schemaJson, url);
                        } else {
                            console.log('received schema does not match expected values:', `${evendor}:${vendor}, ${ename}:${name}, ${eformat}:${format}, ${eversion}:${version}, `);
                        }
                    }
                }).catch(null);
            }
        }

        return {valid: false, errors: ['Could not find or access schema definition in any configured repositories.', 'Try adding your Iglu repository in the extension settings.', 'Make sure you have whitelisted your IP and enabled CORS for the repository.'], location: null};
    },
};
