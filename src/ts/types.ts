import { Entry } from "har-format";
import { Schema } from "jsonschema";
import { StateUpdater } from "preact/hooks";

import { Resolver } from "./iglu";
import { Modal, ModalSetter } from "../components/Modals";

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

export type ExtensionOptions = LocalOptions & SyncOptions;

export interface IDebugger {
  addRequests: (requests: Entry[]) => void;
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
  addRequests: (requests: Entry[]) => void;
  changeApp: StateUpdater<Application>;
  clearRequests: () => void;
  setModal: ModalSetter;
}

export interface IRowSet {
  setName: string;
}

export interface ITimeline {
  isActive: (beacon: IBeaconSummary) => boolean;
  displayMode: DisplayItem["display"];
  requests: Entry[];
  resolver: Resolver;
  setActive: StateUpdater<DisplayItem | undefined>;
  setModal: ModalSetter;
}

export interface IBeacon {
  activeBeacon?: IBeaconSummary;
  resolver: Resolver;
  compact?: boolean;
}

export interface IBadRowsSummary {
  addRequests: (requests: Entry[]) => void;
  setModal: ModalSetter;
}

export interface ITomcatImport {
  [fieldName: string]: string | { [header: string]: string };
}

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
