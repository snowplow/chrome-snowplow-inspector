import m = require("mithril");

import analytics = require("../../ts/analytics");

import Directory = require("./Directory");
import RegistryList = require("./RegistryList");

const SchemaManager = () => {
  const repositories = new Set();
  const schema = new Set();

  return {
    oninit: () => {
      chrome.storage.sync.get({ repolist: [] }, (settings) => {
        for (const repo of settings.repolist) {
          repositories.add(repo);
          analytics.repoAnalytics(repo);
        }
      });

      chrome.storage.local.get({ schemalist: [] }, (settings) => {
        for (const schema of settings.schemalist) {
          let key = "iglu:";

          try {
            key += [
              schema.self.vendor,
              schema.self.name,
              schema.self.format,
              schema.self.version,
            ].join("/");
          } catch {
            continue;
          }

          //cache[key] = schema;
        }
      });
    },
    view: () =>
      m("section.schema-manager.columns.section", [
        m(Directory),
        m(RegistryList),
      ]),
  };
};

export = SchemaManager;
