import jsonschema = require('jsonschema');
import m = require('mithril');
import analytics = require('./analytics');
import { ICache, IErrorMessageSet, ISchemaStatus } from './types';

const cache: ICache = {};
const status: ISchemaStatus = {};
const jsv = new jsonschema.Validator();
const repositories = new Set();

/* tslint:disable:max-line-length */
const SCHEMA_PATTERN = /^iglu:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/([1-9][0-9]*(?:-(?:0|[1-9][0-9]*)){2})$/;

const syncRepos = () => {
    repositories.clear();
    repositories.add('http://iglucentral.com');

    chrome.storage.sync.get({repolist: []}, (settings) => {
        for (const repo of settings.repolist) {
            repositories.add(repo);
            analytics.repoAnalytics(repo);
        }
    });

    chrome.storage.local.get({schemalist: []}, (settings) => {
        for (const schema of settings.schemalist) {
            let key = 'iglu:';

            try {
                key += [schema.self.vendor, schema.self.name, schema.self.format, schema.self.version].join('/');
            } catch {
                continue;
            }

            cache[key] = schema;
        }
    });
};

const persistCache = (key: string, value: jsonschema.Schema, url: string) => {
    cache[key] = value;
    status[key] = url;
    chrome.storage.local.set({schemacache: cache, schemastatus: status});
};

const clearCache = () => {
    for (const p in cache) {
        if (cache.hasOwnProperty(p)) {
            delete cache[p];
        }
    }
    for (const p in status) {
        if (status.hasOwnProperty(p)) {
            delete status[p];
        }
    }
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

chrome.storage.onChanged.addListener((changes) => {
    if ('repolist' in changes || 'schemalist' in changes) {
        clearCache();
        syncRepos();
        m.redraw();
    }
});

syncRepos();

export = {
    clearCache,
    validate: (schema: string, data: object) => {
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

        if (typeof status[schema] === 'undefined') {
            status[schema] = null;

            for (const repo of Array.from(repositories)) {
                const url = [repo, 'schemas', evendor, ename, eformat, eversion].join('/');

                const parsedUrl = new URL(url);
                const apikey = parsedUrl.username;
                parsedUrl.username = '';

                m.request(parsedUrl.href, {headers: {apikey}}).then((schemaJson) => {
                    if (schemaJson.hasOwnProperty('self')) {
                        const {vendor, name, format, version} = (schemaJson as any).self;
                        if (evendor === vendor && ename === name && eformat === format && eversion === version) {
                            persistCache(schema, schemaJson, url);
                        } else {
                            console.log('received schema does not match expected values:', `${evendor}:${vendor}, ${ename}:${name}, ${eformat}:${format}, ${eversion}:${version}, `);
                        }
                    }
                }).catch((error) => {
                    if (error.message && status[schema] === null) {
                        status[schema] = 'error';
                    } else if (error.message === ''  && (status[schema] === null || status[schema] === 'error')) {
                        status[schema] = 'cors';
                    }
                });
            }
        }

        const errors: IErrorMessageSet = {
            cors: [
                'Schema could not be found in any configured repositores.',
                'At least one repository had CORS errors while requesting the schema.',
            ],
            default: [
                'Could not find or access schema definition in any configured repositories.',
            ],
            error: [
                'Schema could not be found in any configured repositories.',
                'Try adding your Iglu repository in the extension settings.',
                'Make sure you have whitelisted your IP address.',
            ],
        };

        return {
            errors: errors[status[schema] || 'default'] || [],
            location: null,
            valid: false,
        };
    },
};
