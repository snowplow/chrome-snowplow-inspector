import type { Entry } from "har-format";
import type { Schema } from "jsonschema";
import type { RefObject } from "preact";
import type { Dispatch, StateUpdater } from "preact/hooks";

import type { Resolver } from "./iglu";
import type { DestinationManager } from "./DestinationManager";
import type { ModalSetter } from "../components/Modals";

export type Application =
  | "debugger"
  | "schemaManager"
  | "attributes"
  | "interventions";

export type RegistryStatus = "OK" | "UNHEALTHY";

interface LocalOptions {
  schemalist?: string[];
  schemacache?: { [uri: string]: any };
  schemastatus?: { [uri: string]: any };
  localSchemas: string; // { [registry: string]: Omit<ResolvedIgluSchema, "registry">[] };
}
interface SyncOptions {
  enableTracking: boolean;
  repolist: string[];
}

export type SignalsInstall = {
  endpoint: string;
  orgId: string;
  orgName: string;
  label: string;
  name: string;
};

export interface IConsoleStatus {
  forceCollapsed: boolean;
  login?: OAuthResult;
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
}

export type ExtensionOptions = LocalOptions & SyncOptions;

export type OAuthIdentity = {
  iss: string;
  sid: string;
  name: string;
  sub: string;
  updated_at: string;
  picture: string;
};

export type OAuthAccess = {
  exp: number;
  "https://snowplowanalytics.com/roles": {
    user: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
      };
    };
    groups: string[];
  };
};

export type BatchContents = {
  id: string;
  collector: string;
  collectorPath: string;
  method: string;
  pageref?: string;
  events: Map<string, string>[];
  serverAnonymous: boolean;
  status: number;
  statusText: string;
  sendingPage?: string;
};

export type OAuthResult = {
  identity: OAuthIdentity;
  access: OAuthAccess;
  authentication: Partial<RequestInit>;
  logout: () => Promise<string>;
};

export type Organization = {
  id: string;
  name: string;
  domain: string;
  tier: string;
  tags: string[];
  essoDomain?: string;
  features: null | unknown;
  featuresV2?: {
    signals?: { enabled: boolean };
  };
};

export interface IDebugger {
  destinationManager: DestinationManager;
  batches: BatchContents[];
  listenerStatus: "waiting" | "importing" | "active";
  requestsRef: RefObject<Entry[]>;
  resolver: Resolver;
  setApp: Dispatch<StateUpdater<Application>>;
  setModal: ModalSetter;
  addRequests: (requests: Entry[]) => void;
  setRequests: Dispatch<StateUpdater<Entry[]>>;
}

export interface IPageRequests {
  page: string;
  entries: Entry[];
}

export interface IBeaconSummary {
  appId?: string;
  collector: string;
  eventName: string;
  pageref?: string;
  id: string;
  method: string;
  page?: string;
  payload: Map<string, string>;
  time: Date;
  serverAnonymous: boolean;
  collectorStatus: {
    code: number;
    text: string;
  };
}

export type BeaconValidity = "Valid" | "Unrecognised" | "Invalid";
export type FieldDetail = [
  field: string,
  value: string,
  param: string,
  classes: string,
];
export type BeaconDetail = [group: string, fields: FieldDetail[]];

export interface IBeaconDetails {
  appId: string;
  collector: string;
  data: BeaconDetail[];
  method: string;
  name: string;
  time: string;
  payload?: IBeaconSummary["payload"];
  serverAnonymous: boolean;
}

export interface ICache {
  [igluUri: string]: Schema;
}

export interface ISchemaStatus {
  [igluUri: string]: string | null;
}

export interface IErrorMessageSet {
  [errorType: string]: string[];
}

export interface IToolbar {
  application: Application;
  eventCount?: number;
  interventionCount?: number;
  login?: OAuthResult;
  setApp: Dispatch<StateUpdater<Application>>;
  setLogin: Dispatch<StateUpdater<OAuthResult | undefined>>;
}

export interface IRowSet {
  setName: string;
}

export interface ITimeline {
  active: IBeaconSummary | undefined;
  addRequests: (requests: Entry[]) => void;
  clearRequests: () => void;
  batches: BatchContents[];
  requestsRef: RefObject<Entry[]>;
  destinationManager: DestinationManager;
  resolver: Resolver;
  setActive: Dispatch<StateUpdater<IBeaconSummary | undefined>>;
  setApp: Dispatch<StateUpdater<Application>>;
  setModal: ModalSetter;
}

export interface IBeacon {
  activeBeacon: IBeaconSummary;
  resolver: Resolver;
  setModal: ModalSetter;
  pipelines: PipelineInfo[];
  pinned: string[];
  setPinned: Dispatch<StateUpdater<string[]>>;
}

export interface IBadRowsSummary {
  addRequests: (requests: Entry[]) => void;
  setModal: ModalSetter;
}

export interface ITomcatImport {
  [fieldName: string]: string | { [header: string]: string };
}

export type PipelineInfo = {
  id: string;
  organization: string;
  organizationName: string;
  domain: string;
  domains: string[];
  enrichments: {
    id: string;
    filename: string;
    lastUpdate: string;
    enabled: boolean;
    content: unknown;
  }[];
  resource: "minis" | "pipelines";
  cleanEndpoint: string | undefined;
  cloudProvider: string;
};

export interface RegistrySpec {
  kind: "local" | "ds" | "static" | "iglu";
  id?: string;
  name: string;
  [opt: string]: any;
}

export type TestSuiteCondition = {
  name?: string;
  description?: string;
  type?: "condition";
} & (
  | {
      target: string;
      operator: "exists";
    }
  | {
      target: string;
      operator: "not_exists";
    }
  | {
      target: string;
      operator: "matches";
      value: string;
    }
  | {
      target: string;
      operator: "one_of";
      value: any[];
    }
  | {
      target: string;
      operator: "equals";
      value: any;
    }
  | {
      target: string;
      operator: "validates";
      value: Schema;
    }
);

interface TestSuite {
  name: string;
  description?: string;
  targets?: TestSuiteCondition[];
  combinator?: "and" | "or" | "not";
  type?: string;
}

interface GroupedTestSuiteSpec extends TestSuite {
  type?: "group";
  tests: TestSuiteSpec[];
}

export interface TestSuiteCase extends TestSuite {
  type?: "case";
  conditions: TestSuiteCondition[];
}

export type TestSuiteSpec = GroupedTestSuiteSpec | TestSuiteCase;

type ResultStatus = "pass" | "fail" | "incomplete";

export type TestSuiteResult =
  | {
      test: TestSuiteSpec;
      status: ResultStatus;
      results: TestSuiteResult[];
    }
  | {
      test: TestSuiteSpec;
      status: ResultStatus;
      result: {
        success: IBeaconSummary[];
        failure: IBeaconSummary[];
        passCauses: [TestSuiteCondition, string?][];
        failCauses: [TestSuiteCondition, string?][];
      };
    };

export type NgrokEvent = {
  uri: string;
  id: string;
  tunnel_name: string;
  remote_addr: string;
  start: string;
  duration: number;
  request: {
    method: string;
    proto: string;
    headers: { [key: string]: string }; // arbitrary key value
    uri: string;
    raw: string;
  };
  response: {
    status: string;
    status_code: number;
    proto: string;
    headers: { [key: string]: string }; // arbitrary key value
    raw: string;
  };
};
