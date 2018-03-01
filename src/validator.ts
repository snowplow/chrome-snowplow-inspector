import jsonschema = require('jsonschema');
import m = require('mithril');

const cache = {};
const status = {};
const jsv = new jsonschema.Validator();
const repositories = new Set();

/* tslint:disable:max-line-length */
const SCHEMA_PATTERN = /^iglu:([a-zA-Z0-9\\-_.]+)\/([a-zA-Z0-9\\-_]+)\/([a-zA-Z0-9\\-_]+)\/([1-9][0-9]*(?:-(?:0|[1-9][0-9]*)){2})$/;

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
    console.log('loading local settings:', settings);
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
    console.log('schema cache:', cache);
    console.log('schema status:', status);
});

export = {
    validate: (schema, data) => {
        const match = SCHEMA_PATTERN.exec(schema);
        if (!match) {
            return {valid: false, errors: ['Invalid Iglu URI identifying schema.'], location: null};
        }

        if (schema in cache) {
            const result = jsv.validate(data, cache[schema]) as any;
            result.location = status[schema];
            return result;
        }

        const [evendor, ename, eformat, eversion] = match.slice(1);

        if (!(schema in status)) {
            console.log('attempting to fetch', schema, status, cache);
            status[schema] = null;

            for (const repo of Array.from(repositories)) {
                const url = [repo, 'schemas', evendor, ename, eformat, eversion].join('/');

                m.request(url).then((schemaJson) => {
                    console.log('got schema', schema, 'from URL:', url, schemaJson);
                    if (schemaJson.hasOwnProperty('self')) {
                        const {vendor, name, format, version} = (schemaJson as any).self;
                        if (evendor === vendor && ename === name && eformat === format && eversion === version) {
                            console.log('found schema for', schema, schemaJson);
                            persistCache(schema, schemaJson, url);
                        } else {
                            console.log('received schema does not match expected values:', `${evendor}:${vendor}, ${ename}:${name}, ${eformat}:${format}, ${eversion}:${version}, `);
                        }
                    }
                }).catch(function() {console.log('fetch caught:', this, arguments); });
            }
        }

        return {valid: false, errors: ['Could not find or access schema definition in any configured repositories.', 'Try adding your Iglu repository in the extension settings.', 'Make sure you have whitelisted your IP and enabled CORS for the repository.'], location: null};
    },
};
