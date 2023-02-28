import { Entry } from "har-format";

import { IBeaconSummary } from "../../../ts/types";

import toCsv from "./csv";
import toHar from "./har";
import toJson from "./json";

export const formats = {
  csv: "CSV",
  har: "HAR",
  json: "json",
} as const;

const exporters = {
  csv: toCsv,
  har: toHar,
  json: toJson,
};

export type ExporterFormat = keyof typeof formats;

export const exportToFormat = (
  format: ExporterFormat,
  requests: Entry[],
  events: IBeaconSummary[][]
) => {
  const fakeA = document.createElement("a");

  const file = exporters[format](requests, events);
  fakeA.download = file.name;
  const url = URL.createObjectURL(file);
  fakeA.href = url;
  fakeA.click();
  URL.revokeObjectURL(url);
};
