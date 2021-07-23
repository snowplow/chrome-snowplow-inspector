import { default as m, Vnode } from "mithril";
import { protocol } from "../../ts/protocol";
import {
  BeaconDetail,
  IBeacon,
  IBeaconDetails,
  IBeaconSummary,
  IRowSet,
  FieldDetail,
} from "../../ts/types";
import { b64d, hasMembers, nameType, copyToClipboard } from "../../ts/util";
import { validate } from "../../ts/validator";

type ProtocolField = typeof protocol.paramMap[keyof typeof protocol.paramMap];

function genClasses(finfo: ProtocolField): string {
  const classes = [];

  if (finfo.deprecated) {
    classes.push("deprecated");
  }

  return classes.join(" ");
}

function parseBeacon({
  collector,
  method,
  payload,
}: IBeaconSummary): IBeaconDetails {
  const result: IBeaconDetails = {
    appId: printableValue(payload.get("aid"), protocol.paramMap.aid),
    collector,
    data: [],
    method,
    name: printableValue(payload.get("e"), protocol.paramMap.e),
    time: printableValue(
      payload.get("stm") || payload.get("dtm"),
      protocol.paramMap.stm
    ),
  };

  const seen = new Set<string>();

  for (const gp of protocol.groupPriorities) {
    const name = gp.name;
    const fields = gp.fields;
    const rows: FieldDetail[] = [];

    for (const field of fields) {
      const finfo = protocol.paramMap[field];

      let val = payload.get(field);

      val = printableValue(val, finfo);

      if (val != null) {
        rows.push([finfo.name, val, genClasses(finfo)]);
        seen.add(field);
      }
    }

    if (rows.length) {
      result.data.push([name, rows]);
    }
  }

  const unknownRows: FieldDetail[] = [];
  for (const [k, v] of payload) {
    if (!seen.has(k)) {
      unknownRows.push([k, v, "unknown"]);
    }
  }

  if (unknownRows.length) {
    result.data.push(["Unrecognised Fields", unknownRows]);
  }

  return result;
}

const labelType = (val: string) =>
  m(
    "button.typeinfo.button.is-pulled-right.is-info",
    { onclick: () => copyToClipboard(val), title: "Click to copy" },
    nameType(val)
  );
const contextToTable = (obj: any): Vnode | string => {
  if (typeof obj !== "object" || obj === null) {
    return JSON.stringify(obj).replace(/^"|"$/g, "");
  }

  const rows = [];
  let p;

  if ("schema" in obj && "data" in obj) {
    const validation = validate(obj.schema, obj.data);
    const validity = validation.valid
      ? "Valid"
      : validation.location === null
      ? "Unrecognised"
      : "Invalid";
    const errorText = validation.errors.join("\n") || validation.location;

    if ("schema" in obj.data) {
      rows.push(contextToTable(obj.data));
    } else {
      for (p in obj.data) {
        if (obj.data.hasOwnProperty(p)) {
          const type = nameType(obj.data[p]);
          if (
            (type === "object" || type === "array") &&
            hasMembers(obj.data[p])
          ) {
            rows.push(
              m("tr", [m("th", p), m("td", contextToTable(obj.data[p]))])
            );
          } else {
            rows.push(
              m("tr", [
                m("th", p),
                m("td", [labelType(obj.data[p]), contextToTable(obj.data[p])]),
              ])
            );
          }
        }
      }
    }

    return m(
      "div.card.iglu",
      { class: validity.toLowerCase() },
      m(
        "header.card-header",
        m(
          "a.card-header-title",
          {
            target: "_blank",
            href: validation.location || "javascript:void(0);",
          },
          obj.schema
        ),
        m("span.card-header-icon", "")
      ),
      m("div.card-content", m("table.table.is-fullwidth", rows)),
      m(
        "footer.card-footer",
        m(
          "abbr.card-footer-item.validation",
          {
            onclick: () => {
              if (validity === "Unrecognised") {
                chrome.runtime.openOptionsPage();
              } else {
                copyToClipboard(errorText);
              }
            },
            title: errorText,
          },
          validity
        ),
        m("textarea.card-footer-item[readonly]", { value: JSON.stringify(obj) })
      )
    );
  } else {
    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        const type = nameType(obj[p]);
        if ((type === "object" || type === "array") && hasMembers(obj[p])) {
          rows.push(m("tr", [m("th", p), m("td", contextToTable(obj[p]))]));
        } else {
          rows.push(
            m("tr", [
              m("th", p),
              m("td", [labelType(obj[p]), contextToTable(obj[p])]),
            ])
          );
        }
      }
    }

    return m("table.table.is-fullwidth", rows);
  }
};

const RowSet = () => {
  let visible = true;
  return {
    view: (vnode: Vnode<IRowSet>) =>
      m(
        "div.card.tile.is-child",
        { class: visible ? "show-rows" : "hide-rows" },
        m(
          "header.card-header",
          { onclick: () => (visible = !visible) },
          m("p.card-header-title", vnode.attrs.setName),
          m("a.card-header-icon", visible ? "[ - ]" : "[ + ]")
        ),
        m("div.card-content", m("table.table.is-fullwidth", vnode.children))
      ),
  };
};

const toTable = ([setName, rows]: BeaconDetail) =>
  m(
    RowSet,
    { setName },
    rows.map(([name, val, classes]) =>
      !/Custom Context|(Unstructured|Self-Describing) Event/.test(name)
        ? m("tr", { class: classes }, [
            m("th", name),
            m("td", [labelType(val), contextToTable(val)]),
          ])
        : contextToTable(val)
    )
  );

const printableValue = (val: string | undefined, finfo: ProtocolField): any => {
  if (val === undefined || val === null || val === "") {
    return null;
  }

  switch (finfo.type) {
    case "text":
      return val;
    case "epoc":
      return new Date(parseInt(val, 10)).toISOString();
    case "numb":
      return parseInt(val, 10);
    case "doub":
      return parseFloat(val);
    case "bool":
      return val === "1";
    case "uuid":
      return val.toLowerCase();
    case "json":
      return JSON.parse(val);
    case "ba64":
      return printableValue(b64d(val), {
        name: finfo.name,
        type: finfo.then,
      } as ProtocolField);
    case "enum":
      return val;
    case "emap":
      return finfo.values[val] || val;
    default:
      return val;
  }
};

const formatBeacon = ({
  appId,
  name,
  time,
  collector,
  method,
  data,
}: IBeaconDetails) =>
  [
    m("div.level.box", [
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "App"), m("p.title", appId)])
      ),
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "Event"), m("p.title", name)])
      ),
    ]),
    m("div.level.box", [
      m(
        "div.level-item.has-text-centered",
        m("div", [
          m("p.heading", "Time"),
          m("time.title", { datetime: time }, new Date(time).toUTCString()),
        ])
      ),
    ]),
    m("div.level.box", [
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "collector"), m("p.title", collector)])
      ),
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "Method"), m("p.title", method)])
      ),
    ]),
  ].concat(data.map(toTable));

export const Beacon = {
  view: ({ attrs: { activeBeacon } }: Vnode<IBeacon>) =>
    activeBeacon && formatBeacon(parseBeacon(activeBeacon)),
};
