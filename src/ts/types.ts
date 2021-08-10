import { Entry } from "har-format";
import { Schema } from "jsonschema";

import { Resolver } from "./iglu";
import { Modal } from "../components/Modals";

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
}

export interface IPageRequests {
  page: string;
  entries: Entry[];
}

export interface IBeaconSummary {
  appId?: string;
  collector: string;
  eventName: string;
  id: string;
  method: string;
  page?: string;
  payload: Map<string, string>;
  time: string;
  validity: BeaconValidity;
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
  changeApp: (app: Application) => void;
  clearRequests: () => void;
  setModal: (modalName?: Modal) => void;
}

export interface IRowSet {
  setName: string;
}

export interface ITimeline {
  isActive: (beacon: IBeaconSummary) => boolean;
  filter?: RegExp;
  requests: Entry[];
  resolver: Resolver;
  setActive: (beacon: IBeaconSummary) => void;
}

export interface IBeacon {
  activeBeacon?: IBeaconSummary;
  resolver: Resolver;
}

export interface IBadRowsSummary {
  addRequests: (requests: Entry[]) => void;
  setModal: (modalName?: Modal) => void;
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
