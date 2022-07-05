import { h, FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { ModalOptions } from ".";

import { objHasProperty } from "../../ts/util";
import { TestSuiteCondition, TestSuiteSpec } from "../../ts/types";

export interface EditTestSuitesOptions extends ModalOptions {
  suites: TestSuiteSpec[];
  setSuites: (newSuites: TestSuiteSpec[]) => void;
}

const SUITE_TEMPLATE: TestSuiteSpec = {
  name: "Example Test Suite",
  description:
    "This is an example test suite. It only tests Snowplow events where the collector returned an OK status.",
  targets: [
    {
      target: "payload.e",
      operator: "exists",
    },
    {
      target: "collectorStatus.code",
      operator: "equals",
      value: 200,
    },
  ],
  tests: [
    {
      name: "Events have App ID",
      description:
        "App ID is not a mandatory field but is useful to provide, check all Snowplow events include one.",
      conditions: [
        {
          target: "payload.aid",
          operator: "matches",
          value: ".+",
        },
      ],
    },
    {
      name: "Event Validation",
      description: "Events should all pass validation.",
      conditions: [
        {
          target: "validity",
          operator: "equals",
          value: "valid",
        },
      ],
    },
    {
      name: "Context Validation",
      description: "You can dig into context data too.",
      conditions: [
        {
          target:
            "payload.context.com_snowplowanalytics_snowplow.web_page.$version",
          operator: "equals",
          value: "1-0-0",
        },
        {
          target: "payload.context.com_snowplowanalytics_snowplow.web_page.id",
          operator: "matches",
          value: "^[a-f0-9-]{36}$",
        },
      ],
    },
    {
      name: "Test Failure",
      description:
        "This test should always fail because an event should only be one of these types.",
      conditions: [
        {
          target: "payload.e",
          operator: "one_of",
          value: ["pv", "pp", "ue", "se", "tr", "ti"],
        },
      ],
      combinator: "not",
    },
  ],
  combinator: "and",
};

const validateTestCondition = (data: unknown): data is TestSuiteCondition => {
  if (typeof data !== "object" || !data)
    throw Error("Condition must be an object");
  if (!objHasProperty(data, "target"))
    throw Error("Condition must specify a target");
  if (typeof data.target !== "string" || !data.target)
    throw Error("Condition target must be a string");

  return true;
};

const validateTestSuite = (text: string): TestSuiteSpec => {
  let val: unknown;
  try {
    val = JSON.parse(text);
  } catch (e) {
    throw Error("Invalid JSON text in test suite definition");
  }

  if (typeof val !== "object" || !val)
    throw Error("Test suite must be an object");
  if (!objHasProperty(val, "name")) throw Error("Test Suites must have a name");
  if (typeof val["name"] !== "string")
    throw Error("Test Suite name must be a string");
  if (objHasProperty(val, "tests") && objHasProperty(val, "conditions"))
    throw Error(
      "Test Suite may only contain its own conditions or other tests"
    );

  if (objHasProperty(val, "targets")) {
    if (!Array.isArray(val.targets))
      throw Error("Test Suite targets must be an array");
    try {
      if (!val.targets.every(validateTestCondition))
        throw Error("Test Suite target missing or invalid");
    } catch (e) {
      throw Error("Test Suite target error:" + e);
    }
  }

  if (
    objHasProperty(val, "combinator") &&
    (typeof val.combinator !== "string" ||
      ["and", "or", "not"].indexOf(val.combinator) == -1)
  )
    throw Error("Invalid Test Suite combinator");

  if (objHasProperty(val, "tests")) {
    if (!Array.isArray(val.tests) || !val.tests.length)
      throw Error("Test Suite tests must be an array of at least one test");

    try {
      val.tests.every((test) => validateTestSuite(JSON.stringify(test)));
    } catch (e) {
      throw Error("Nested Test Suite exception: " + e);
    }
  } else if (objHasProperty(val, "conditions")) {
    if (!Array.isArray(val.conditions) || !val.conditions.length)
      throw Error(
        "Test Suite conditions must be an array of at least one condition"
      );

    try {
      if (!val.conditions.every(validateTestCondition))
        throw Error("Test Suite condition missing or invalid");
    } catch (e) {
      throw Error("Test Suite condition error:" + e);
    }
  } else {
    throw Error(
      "One of 'tests' or 'conditions' must be supplied in a Test Suite"
    );
  }

  return val as TestSuiteSpec;
};

export const EditTestSuites: FunctionComponent<EditTestSuitesOptions> = ({
  setModal,
  setSuites,
  suites,
}) => {
  const [editing, setEditing] = useState(suites);

  return (
    <div class="modal is-active">
      <div class="modal-background" onClick={() => setModal()}></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Edit Test Suites</p>
          <button class="delete" type="button" onClick={() => setModal()} />
        </header>
        <section class="modal-card-body">
          <details>
            <summary>What are Test Suites?</summary>
            <p>
              Test Suites allow you to define checks against all the events
              displayed in the extension at once.
            </p>
            <p>
              Test Suites add the flexibility to check the absence of tracking
              (e.g. "Fail if event A does not occur"), as well as verify
              requirements that are higher-level than can be defined at a
              Self-Describing schema-level (e.g. "Event B must contain Context X
              with a valid Y property and be valid according to the schema").
            </p>
            <p>
              This can save you time if you already have a normal site test
              procedure: you can define all your tracking expectations as a Test
              Suite and you then don't need to manually verify that all your
              requirements are met as you use each feature, you can just check
              at the end and see which features had invalid or missing tracking.
            </p>
            <p>
              This functionality also works with imported events from other
              devices (e.g. via a HAR file containing events sent from a mobile
              device).
            </p>
          </details>
          <form
            id="edit-testsuites"
            class="form testsuite-definition"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();

              const target = event.currentTarget;
              if (target.reportValidity()) {
                const newSuites: TestSuiteSpec[] = [];
                Array.from(target.elements).forEach((field) => {
                  if (field instanceof HTMLTextAreaElement) {
                    try {
                      newSuites.push(validateTestSuite(field.value));
                    } catch (e) {
                      console.warn(e);
                    }
                  }
                });

                setSuites(newSuites);
                setModal();
              }
            }}
          >
            {editing.map((suite, i) => (
              <textarea
                class="textarea"
                name={`suite-${i}`}
                value={JSON.stringify(suite, null, 4)}
                onChange={(event) => {
                  const target = event.currentTarget;
                  if (target.value) {
                    try {
                      validateTestSuite(target.value);
                      target.setCustomValidity("");
                    } catch (e) {
                      target.setCustomValidity("" + e);
                    }
                  } else target.setCustomValidity("");
                }}
              />
            ))}
          </form>
        </section>
        <footer class="modal-card-foot">
          <button class="button" form="edit-testsuites" name="save-testsuites">
            Save Test Suites
          </button>
          <button
            class="button"
            type="button"
            onClick={() =>
              setEditing(
                editing.concat([JSON.parse(JSON.stringify(SUITE_TEMPLATE))])
              )
            }
          >
            New Suite
          </button>
          <a
            class="button"
            disabled={!suites.length && suites.some(Boolean)}
            download="Snowplow-Test-Suites.json"
            href={
              "data:application/json," +
              encodeURIComponent(JSON.stringify(suites))
            }
            title="Download the file as JSON to your downloads directory"
          >
            Export
          </a>
          <input
            type="file"
            class="button"
            multiple
            onChange={(event) => {
              const target = event.currentTarget;

              if (target.files) {
                Promise.all(
                  Array.from(target.files).map((file: File) =>
                    file.size <= 1024000
                      ? file.text().catch(() => "null")
                      : Promise.resolve("null")
                  )
                ).then((suiteTexts) => {
                  const found: TestSuiteSpec[] = [];
                  suiteTexts.forEach((suite) => {
                    try {
                      const parsed = JSON.parse(suite);
                      if (Array.isArray(parsed)) {
                        const imports = parsed.map((ts) =>
                          validateTestSuite(JSON.stringify(ts))
                        );
                        found.push(...imports);
                      }
                    } catch (e) {
                      console.warn("Import error" + e);
                    }
                  });
                  if (found.length) setEditing(editing.concat(found));
                });
              }
            }}
          >
            Import
          </input>
        </footer>
      </div>
    </div>
  );
};
