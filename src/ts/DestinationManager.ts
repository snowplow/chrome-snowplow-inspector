const DESTINATION_MANAGER_REDIR_RULE_ID = 50;
const DESTINATION_MANAGER_CORSFIX_RULE_ID = 51;
const FILTER_TEMPLATE =
  "^[^:]+://[^/]+(/com\\.snowplowanalytics\\.snowplow/tp.$|/i\\?.+|CUSTOM)$";

export class DestinationManager {
  private readonly destinations: Record<string, string[]> = {};
  private endpoint: URL | null = null;
  private enabled: boolean = false;

  constructor() {
    chrome.storage.local.get(
      {
        forwardDestinations: "{}",
        forwardEndpoint: null,
        forwardEnabled: false,
      },
      ({ forwardDestinations, forwardEndpoint, forwardEnabled }) => {
        this.enabled = !!forwardEnabled;
        try {
          const destinations = JSON.parse(forwardDestinations);

          if (destinations && typeof destinations === "object") {
            Object.entries(destinations).forEach(
              ([destination, customPaths]) => {
                if (Array.isArray(customPaths)) {
                  this.destinations[destination] = customPaths;
                } else {
                  this.destinations[destination] = [];
                }
              },
            );
          }
        } catch (e) {}

        if (forwardEndpoint) {
          try {
            this.endpoint = new URL(forwardEndpoint);
          } catch (e) {}
        }

        this.sync();
      },
    );
  }

  persist() {
    chrome.storage.local.set({
      forwardDestinations: JSON.stringify(this.destinations),
      forwardEndpoint: this.endpoint ? this.endpoint.href : null,
      forwardEnabled: this.enabled,
    });
  }

  update(
    destinations: string[],
    endpoint: string | URL | null,
    enabled: boolean,
  ) {
    this.enabled = enabled;
    this.endpoint = typeof endpoint === "string" ? new URL(endpoint) : endpoint;

    const incoming = new Set(destinations);

    for (const known of Object.keys(this.destinations)) {
      if (incoming.has(known)) continue;
      delete this.destinations[known];
    }

    for (const d of incoming) {
      if (this.destinations[d]) continue;
      this.destinations[d] = [];
    }

    this.sync();
    this.persist();
  }

  sync() {
    const destinations = Object.keys(this.destinations);
    if (!chrome.declarativeNetRequest) return;

    const {
      DomainType,
      HeaderOperation,
      ResourceType,
      RequestMethod,
      RuleActionType,
      updateSessionRules,
    } = chrome.declarativeNetRequest;
    if (!this.enabled || !destinations.length || !this.endpoint) {
      updateSessionRules({
        removeRuleIds: [
          DESTINATION_MANAGER_REDIR_RULE_ID,
          DESTINATION_MANAGER_CORSFIX_RULE_ID,
        ],
      });
    } else if (this.endpoint && destinations.length) {
      const customPaths = [
        ...new Set(Object.values(this.destinations).flat()),
      ].map((path) => path.replace(/([^A-Za-z0-9])/g, "\\$1"));
      const regexFilter = FILTER_TEMPLATE.replace(
        "|CUSTOM",
        customPaths.length ? "|" + customPaths.join("|") : "",
      );

      const endpoint =
        this.endpoint.pathname.length > 1
          ? this.endpoint.href
          : this.endpoint.href.replace(/\/+$/, "") + "\\1";

      updateSessionRules({
        removeRuleIds: [
          DESTINATION_MANAGER_REDIR_RULE_ID,
          DESTINATION_MANAGER_CORSFIX_RULE_ID,
        ],
        addRules: [
          {
            id: DESTINATION_MANAGER_REDIR_RULE_ID,
            action: {
              type: RuleActionType.REDIRECT,
              redirect: {
                regexSubstitution: endpoint,
              },
            },
            condition: {
              regexFilter,
              resourceTypes: [
                ResourceType.MAIN_FRAME,
                ResourceType.SUB_FRAME,
                ResourceType.IMAGE,
                ResourceType.PING,
                ResourceType.XMLHTTPREQUEST,
              ],
              requestDomains: destinations,
              requestMethods: [RequestMethod.GET, RequestMethod.POST],
              tabIds: [chrome.devtools.inspectedWindow.tabId],
            },
          },
          {
            // because the CORS request sends credentials, the browser expects the origin to be pass back in Access-Control-Allow-Origin
            // but when we do the redirect, origin becomes `null` instead of the actual initiator
            // collector doesn't recognize `null` so returns with `*` which is not allowed when credentials are requested
            id: DESTINATION_MANAGER_CORSFIX_RULE_ID,
            action: {
              type: RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                {
                  // match the origin for the outgoing request
                  header: "access-control-allow-origin",
                  operation: HeaderOperation.SET,
                  value: "null",
                },
                {
                  // it gets confused and doesn't read this properly unless we force it for some reason
                  header: "access-control-allow-credentials",
                  operation: HeaderOperation.SET,
                  value: "true",
                },
              ],
            },
            condition: {
              domainType: DomainType.THIRD_PARTY,
              requestDomains: [this.endpoint.hostname],
              requestMethods: [
                RequestMethod.GET,
                RequestMethod.OPTIONS,
                RequestMethod.POST,
              ],
              tabIds: [chrome.devtools.inspectedWindow.tabId],
            },
          },
        ],
      });
    }
  }

  addPath(url: string | URL) {
    try {
      if (typeof url === "string") url = new URL(url);
    } catch (e) {
      return;
    }

    if (
      url.pathname === "/i" ||
      url.pathname === "/com.snowplowanalytics.snowplow/tp2"
    )
      return;

    requestIdleCallback(() => {
      let madeChange = false;
      Object.entries(this.destinations).forEach(([host, paths]) => {
        if (url.host.endsWith(host)) {
          if (!paths.includes(url.pathname)) {
            paths.push(url.pathname);
            madeChange = true;
          }
        }
      });

      if (madeChange) {
        this.sync();
        this.persist();
      }
    });
  }

  status() {
    return {
      endpoint: this.endpoint,
      destinations: Object.keys(this.destinations),
      enabled: this.enabled,
    };
  }
}
