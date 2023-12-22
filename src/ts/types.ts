import { Entry } from "har-format";
import { Schema } from "jsonschema";
import { StateUpdater } from "preact/hooks";

import { Resolver } from "./iglu";
import { ModalSetter } from "../components/Modals";

export type Application = "debugger" | "schemaManager";

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

export interface IConsoleStatus {
  resolver: Resolver;
  setModal: ModalSetter;
}

export type ExtensionOptions = LocalOptions & SyncOptions;

export type OAuthIdentity = {
  iss: string;
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

export interface IDebugger {
  addRequests: (requests: Entry[]) => void;
  clearRequests: () => void;
  events: Entry[];
  resolver: Resolver;
  setModal: ModalSetter;
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
  time: string;
  validity: BeaconValidity;
  serverAnonymous: boolean;
  collectorStatus: {
    code: number;
    text: string;
  };
}

export type BeaconValidity = "Valid" | "Unrecognised" | "Invalid";
export type FieldDetail = [field: string, value: string, classes: string];
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
  changeApp: StateUpdater<Application>;
  setModal: ModalSetter;
  resolver: Resolver;
}

export interface IRowSet {
  setName: string;
}

export interface ITimeline {
  isActive: (beacon: IBeaconSummary) => boolean;
  addRequests: (requests: Entry[]) => void;
  clearRequests: () => void;
  displayMode: DisplayItem["display"];
  requests: Entry[];
  resolver: Resolver;
  setActive: StateUpdater<DisplayItem | undefined>;
  setModal: ModalSetter;
}

export interface IBeacon {
  activeBeacon: IBeaconSummary;
  resolver: Resolver;
  setModal: ModalSetter;
  pipelines: PipelineInfo[];
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

export type DisplayItem =
  | {
      display: "beacon";
      item: IBeaconSummary;
    }
  | {
      display: "testsuite";
      item: TestSuiteResult;
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
