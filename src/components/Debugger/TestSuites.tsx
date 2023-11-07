import { h, FunctionComponent } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { Validator } from "jsonschema";

import {
  DisplayItem,
  IBeaconSummary,
  TestSuiteCase,
  TestSuiteCondition,
  TestSuiteResult,
  TestSuiteSpec,
} from "../../ts/types";
import { tryb64 } from "../../ts/util";
import { ModalSetter } from "../Modals";

import "./TestSuites.scss";

const validator = new Validator();

const substitute = (s: string, params?: Record<string, string>) =>
  s.replace(/(^|.)\{([^}])\}/g, (full, prefix, lookup): string => {
    if (prefix === "\\") return full;
    const [key, ...operator] = lookup.split(":");
    let val = (params || {})[key];

    const mod = operator.join(":");
    if (mod) {
      switch (mod[0]) {
        case "-":
          if (!val) val = mod.slice(1);
          break;
        case "+":
          if (val) val = mod.slice(1);
          break;
        case "=":
          if (params && !val) val = params[key] = mod.slice(1);
          break;
        case "?":
          if (!val)
            throw Error(
              `Required config parameter "${key}" not set (${mod.slice(1)})`,
            );
          break;
      }
    }

    return prefix + val;
  });

export const unpackSDJ = (
  sdjs: { schema: string; data: any }[],
): Record<string, Record<string, any[]>> => {
  const result: Record<string, Record<string, any[]>> = {};

  sdjs.forEach((sdj) => {
    const [vendor, name, format, version] = sdj.schema
      .replace("iglu:", "")
      .replace(/\./g, "_")
      .split("/");

    if (!result[vendor]) result[vendor] = {};
    if (!result[vendor][name]) result[vendor][name] = [];

    result[vendor][name].push({
      $vendor: vendor,
      $name: name,
      $format: format,
      $version: version,
      ...sdj.data,
    });
  });

  return result;
};

const getTarget = (
  target: string,
  event: IBeaconSummary,
  params?: Record<string, string>,
): string | undefined => {
  const path = substitute(target, params).split(".");

  let result: Record<string, any> = event;
  let next: string | undefined;
  while ((next = path.shift()) && typeof result === "object" && result) {
    if (result instanceof Map) {
      if (next == "unstruct") {
        if (result.get("ue_pr")) next = "ue_pr";
        if (result.get("ue_px")) next = "ue_px";
      } else if (/^contexts?$/.test(next)) {
        if (result.get("co")) next = "co";
        if (result.get("cx")) next = "cx";
      }

      result = result.get(next);
    } else if (Array.isArray(result)) {
      next = /^\[\d+\]$/.test(next) ? next.slice(1, -1) : next;
      const intKey = parseInt(next, 10);
      if (isNaN(intKey)) {
        result = result[0][next];
      } else {
        result = result[intKey];
      }
    } else {
      result = result[next];
    }

    if (
      ["ue_pr", "ue_px", "co", "cx"].includes(next) &&
      typeof result === "string"
    ) {
      try {
        const extracted = JSON.parse(tryb64(result));
        if (
          typeof extracted === "object" &&
          "schema" in extracted &&
          "data" in extracted
        ) {
          if (
            /^iglu:com.snowplowanalytics.snowplow\/contexts\//.test(
              extracted.schema,
            )
          ) {
            result = unpackSDJ(extracted.data);
          } else if (
            /^iglu:com.snowplowanalytics.snowplow\/unstruct_event\//.test(
              extracted.schema,
            )
          ) {
            result = unpackSDJ([extracted.data]);
          }
        }
      } catch {}
    }
  }

  return typeof result === "undefined"
    ? result
    : typeof result === "string"
    ? result
    : JSON.stringify(result);
};

const evalCondition = (
  condition: TestSuiteCondition,
  event: IBeaconSummary,
  params?: Record<string, string>,
): [boolean, string?] => {
  let target: string | undefined;
  try {
    target = getTarget(condition.target, event, params);
  } catch (e) {
    return [false, "" + e];
  }
  const value =
    "value" in condition
      ? typeof condition.value === "string"
        ? condition.value
        : JSON.stringify(condition.value)
      : undefined;

  switch (condition.operator) {
    case "equals":
      try {
        return [
          target === (value != null ? substitute(value, params) : undefined),
          target,
        ];
      } catch (e) {
        console.log(e);
        return [false, "" + e];
      }
    case "exists":
      return [typeof target !== "undefined", target];
    case "not_exists":
      return [typeof target === "undefined", target];
    case "matches":
      const re = new RegExp(condition.value, "i");
      return [target != null ? re.test(target) : false, target];
    case "validates":
      const subject = JSON.parse(target || "null");

      // Our metadata might fail validation if additionalProperties = false
      if (typeof subject === "object" && subject) {
        delete subject["$format"];
        delete subject["$vendor"];
        delete subject["$version"];
        delete subject["$name"];
      }

      const validation = validator.validate(subject, condition.value);

      return [validation.valid, target];
    case "one_of":
      return [
        Array.isArray(condition.value)
          ? condition.value.indexOf(target) >= 0
          : false,
        target,
      ];
  }

  return [false, condition["operator"]];
};

const evalTest = (
  test: TestSuiteCase,
  events: IBeaconSummary[],
  params?: Record<string, string>,
): TestSuiteResult => {
  const success: IBeaconSummary[] = [];
  const failure: IBeaconSummary[] = [];
  const passCauses: [TestSuiteCondition, string?][] = [];
  const failCauses: [TestSuiteCondition, string?][] = [];

  const conditions = (e: IBeaconSummary): [boolean, string?][] =>
    test.conditions.map((c) => evalCondition(c, e, params));

  events.forEach((event) => {
    let idx: number, ok: boolean, got: string | undefined;

    const results = conditions(event);

    switch (test.combinator) {
      case undefined:
      case "not":
      case "and":
        idx = results.findIndex(([ok]) => ok === (test.combinator === "not"));
        if (idx === -1) {
          success.push(event);
          [ok, got] = results[results.length - 1];
          passCauses.push([test.conditions[test.conditions.length - 1], got]);
        } else {
          failure.push(event);
          [ok, got] = results[idx];
          failCauses.push([test.conditions[idx], got]);
        }
        break;
      case "or":
        idx = results.findIndex(([ok]) => ok === true);
        if (idx === -1) {
          failure.push(event);
          [ok, got] = results[results.length - 1];
          failCauses.push([test.conditions[test.conditions.length - 1], got]);
        } else {
          success.push(event);
          [ok, got] = results[idx];
          passCauses.push([test.conditions[idx], got]);
        }
        break;
    }
  });

  return {
    test,
    status: failure.length ? "fail" : success.length ? "pass" : "incomplete",
    result: {
      success,
      failure,
      passCauses,
      failCauses,
    },
  };
};

const runSuite = (
  spec: TestSuiteSpec,
  events: IBeaconSummary[],
  params?: Record<string, string>,
): TestSuiteResult => {
  const targeting = spec.targets || [];
  const targets = targeting.length
    ? events.filter((e) => targeting.every((t) => evalCondition(t, e)[0]))
    : events;

  if ("tests" in spec) {
    const results = spec.tests.map((test) => runSuite(test, targets, params));

    const incomplete = results.some(({ status }) => status === "incomplete");

    let status: TestSuiteResult["status"] = incomplete ? "incomplete" : "fail";
    switch (spec.combinator) {
      case undefined:
      case "and":
        if (results.every(({ status }) => status === "pass")) status = "pass";
        break;
      case "not":
        if (results.every(({ status }) => status === "fail")) status = "pass";
        break;
      case "or":
        if (results.some(({ status }) => status === "pass")) status = "pass";
        break;
    }

    return {
      test: spec,
      status,
      results,
    };
  } else {
    return evalTest(spec, targets, params);
  }
};

const ValidityOptions = {
  emoji: {
    fail: "\u26d4\ufe0f",
    incomplete: "\ud83d\udd0d\ufe0f",
    pass: "\u2705\ufe0f",
  },
  title: {
    fail: "Test Failed",
    incomplete: "Waiting for eligible events",
    pass: "Test Successful",
  },
};

const ValidityBadge: FunctionComponent<{
  status: TestSuiteResult["status"];
}> = ({ status }) => (
  <span class="validity" title={ValidityOptions["title"][status]}>
    {ValidityOptions["emoji"][status]}
  </span>
);

const TestResult: FunctionComponent<{
  result: TestSuiteResult;
  setActive: (beacon: DisplayItem) => void;
}> = ({ result, setActive }) =>
  "results" in result ? (
    <details class="testgroup">
      <summary title={result.test.description}>
        {result.test.name}
        <ValidityBadge status={result.status} />
      </summary>
      {result.results.map((r) => (
        <TestResult result={r} setActive={setActive} />
      ))}
    </details>
  ) : (
    <a
      class="testresult"
      title={result.test.description}
      onClick={() => setActive({ display: "testsuite", item: result })}
    >
      {result.test.name}
      <ValidityBadge status={result.status} />
    </a>
  );

export const TestSuites: FunctionComponent<{
  events: IBeaconSummary[][];
  setActive: (beacon: DisplayItem) => void;
  setModal: ModalSetter;
}> = ({ events, setActive, setModal }) => {
  const [suites, setSuites] = useState<TestSuiteSpec[]>([]);

  useEffect(() => {
    chrome.storage.local.get(
      {
        testSuites: "[]",
      },
      ({ testSuites }) => {
        try {
          setSuites(JSON.parse(testSuites));
        } catch (e) {
          console.error("error parsing stored testSuites");
        }
      },
    );
  }, []);

  const results = useMemo(
    () =>
      suites.map((suite) => (
        <TestResult
          result={runSuite(suite, events.flat())}
          setActive={setActive}
        />
      )),
    [events, suites],
  );

  return (
    <div class="testsuites">
      <p
        class="testsuites__title"
        title="Test Suites allow you to define assertions about events in the timeline."
      >
        Test Suites
        <button
          class="testsuites__edit"
          type="button"
          title="Edit Test Suites"
          onClick={() =>
            setModal("editTestSuites", {
              suites: JSON.parse(JSON.stringify(suites)),
              setSuites: (newSuites: TestSuiteSpec[]) => {
                chrome.storage.local.set(
                  { testSuites: JSON.stringify(newSuites) },
                  () => setSuites(newSuites),
                );
              },
            })
          }
        >
          {"\u2699\ufe0e"}
        </button>
      </p>
      {results}
    </div>
  );
};
