import { default as m, redraw, Component, ClosureComponent } from "mithril";
import {
  DisplayItem,
  IBeaconSummary,
  TestSuiteCase,
  TestSuiteCondition,
  TestSuiteResult,
  TestSuiteSpec,
} from "../../ts/types";
import { ModalSetter } from "../Modals";

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
              `Required config parameter "${key}" not set (${mod.slice(1)})`
            );
          break;
      }
    }

    return prefix + val;
  });

const getTarget = (
  target: string,
  event: IBeaconSummary,
  params?: Record<string, string>
): string | undefined => {
  const path = substitute(target, params).split(".");

  let result: Record<string, any> = event;
  let next: string | undefined;
  while ((next = path.shift()) && typeof result === "object" && result) {
    if (result instanceof Map) {
      result = result.get(next);
    } else {
      result = result[next];
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
  params?: Record<string, string>
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
    case "matches":
      const re = new RegExp(condition.value, "i");
      return [target != null ? re.test(target) : false, target];
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
  params?: Record<string, string>
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
  params?: Record<string, string>
): TestSuiteResult => {
  const targeting = spec.targets || [];
  const targets = targeting.length
    ? events.filter((e) => targeting.every((t) => evalCondition(t, e)))
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
    pass: "\u2705",
  },
  title: {
    fail: "Test Failed",
    incomplete: "Waiting for eligible events",
    pass: "Test Successful",
  },
};

const ValidityBadge: Component<{ status: TestSuiteResult["status"] }> = {
  view: ({ attrs: { status } }) =>
    m(
      "span.panel-icon.validity",
      { title: ValidityOptions["title"][status] },
      ValidityOptions["emoji"][status]
    ),
};

const TestResult: Component<{
  result: TestSuiteResult;
  setActive: (beacon: DisplayItem) => void;
}> = {
  view: ({ attrs: { result, setActive } }) =>
    "results" in result
      ? m(
          "details.panel-block",
          m(
            "summary",
            { title: result.test.description },
            result.test.name,
            m(ValidityBadge, { status: result.status })
          ),
          result.results.map((r) => m(TestResult, { result: r, setActive }))
        )
      : m(
          "a.panel-block",
          {
            onclick: () => setActive({ display: "testsuite", item: result }),
            title: result.test.description,
          },
          result.test.name,
          m(ValidityBadge, { status: result.status })
        ),
};

export const TestSuites: ClosureComponent<{
  events: IBeaconSummary[][];
  setActive: (beacon: DisplayItem) => void;
  setModal: ModalSetter;
}> = () => {
  let suites: TestSuiteSpec[] = [];

  return {
    oninit: () => {
      chrome.storage.local.get(
        {
          testSuites: "[]",
        },
        ({ testSuites }) => {
          try {
            suites = JSON.parse(testSuites);
            redraw();
          } catch (e) {
            console.error("error parsing stored testSuites");
          }
        }
      );
    },
    view: ({ attrs: { events, setActive, setModal } }) =>
      m(
        "div.panel.testsuites",
        m(
          "p.panel-heading",
          {
            title:
              "Test Suites allow you to define assertions about events in the timeline.",
          },
          "Test Suites",
          m(
            "button.button[type=button]",
            {
              title: "Edit Test Suites",
              onclick: () =>
                setModal("editTestSuites", {
                  suites: JSON.parse(JSON.stringify(suites)),
                  setSuites: (newSuites: TestSuiteSpec[]) => {
                    chrome.storage.local.set(
                      { testSuites: JSON.stringify(newSuites) },
                      () => {
                        suites = newSuites;
                        redraw();
                      }
                    );
                  },
                }),
            },
            "\ud83d\udd89"
          )
        ),
        suites.map((suite) =>
          m(TestResult, { result: runSuite(suite, events.flat()), setActive })
        )
      ),
  };
};
