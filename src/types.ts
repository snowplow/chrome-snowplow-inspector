import * as har from 'har-format';
import jsonschema = require('jsonschema');

export interface IPageRequests {
    page: string;
    entries: har.Entry[];
}

export interface IBeaconSummary {
    appId: string;
    collector: string;
    eventName: string;
    id: string;
    method: string;
    page: string;
    payload: Map<string, string>;
    time: string;
}

export type BeaconDetail = [string, any, string];

export interface IBeaconDetails {
    appId: string;
    collector: string;
    data: BeaconDetail[];
    method: string;
    name: string;
    time: string;
}

export interface ICache {
    [igluUri: string]: jsonschema.Schema;
}

export interface ISchemaStatus {
    [igluUri: string]: string | null;
}

export interface IErrorMessageSet {
    [errorType: string]: string[];
}

export interface IToolbar {
    setModal: (modalName: string) => void;
    clearRequests: () => void;
}

export interface IRowSet {
    setName: string;
}

export interface ITimeline {
    isActive: (beacon: IBeaconSummary) => boolean;
    filter?: RegExp;
    request: IPageRequests;
    setActive: (beacon: IBeaconSummary) => void;
}

export interface IBeacon {
    activeBeacon?: IBeaconSummary;
}

export interface IBadRowsSummary {
    addRequests: (pagename: string, requests: har.Entry[]) => void;
    modal?: string;
    setModal: (modalName?: string) => void;
}

export interface ITomcatImport  {
    [fieldName: string]: string | { [header: string]: string };
}

interface IProtTextField {
    deprecated?: boolean;
    header?: 'text';
    name: string;
    type: 'text';
}

interface IProtBoolField {
    deprecated?: boolean;
    name: string;
    type: 'bool';
}

interface IProtNumbField {
    deprecated?: boolean;
    name: string;
    type: 'numb';
}

interface IProtDoubField {
    deprecated?: boolean;
    name: string;
    type: 'doub';
}

interface IProtUuidField {
    cookie?: string;
    deprecated?: boolean;
    name: string;
    type: 'uuid';
}

interface IProtJsonField {
    deprecated?: boolean;
    name: string;
    type: 'json';
}

interface IProtBa64Field {
    deprecated?: boolean;
    name: string;
    then: 'json';
    type: 'ba64';
}

interface IProtEnumField {
    deprecated?: boolean;
    name: string;
    type: 'enum';
    values: string[];
}

interface IProtEpocField {
    deprecated?: boolean;
    name: string;
    type: 'epoc';
}

interface IProtEmapField {
    deprecated?: boolean;
    name: string;
    type: 'emap';
    values: {[val: string]: string};
}

export type ProtocolField = IProtBa64Field |
                             IProtBoolField |
                             IProtDoubField |
                             IProtEmapField |
                             IProtEnumField |
                             IProtEpocField |
                             IProtJsonField |
                             IProtNumbField |
                             IProtTextField |
                             IProtUuidField;
