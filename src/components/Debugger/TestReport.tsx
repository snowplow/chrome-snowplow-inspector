import { h, FunctionComponent, Fragment } from "preact";

import {
  DisplayItem,
  IBeaconSummary,
  TestSuiteCondition,
  TestSuiteResult,
} from "../../ts/types";

import "./TestReport.scss";

const DisplayEvents: FunctionComponent<{
  rows: IBeaconSummary[];
  setActive: (item: DisplayItem) => void;
  title: string;
  causes: [TestSuiteCondition, string?][];
}> = ({ rows, setActive, title, causes }) => (
  <details class="testreport" open>
    <summary>
      {title} ({rows.length})
    </summary>
    <table>
      <tr>
        <th>Event Type</th>
        <th>App ID</th>
        <th>Page</th>
        <th>Condition</th>
        <th>Actual</th>
        <th>Timestamp</th>
      </tr>
      {rows.map((e, i) => (
        <tr
          title={[`Collector: ${e.collector}`, `Method: ${e.method}`].join(
            "\n",
          )}
          class="testreport__event"
          onClick={() => setActive({ display: "beacon", item: e })}
        >
          <td>{e.eventName}</td>
          <td>{e.appId}</td>
          <td>
            <a href={e.page} target="_blank">
              {e.page}
            </a>
          </td>
          <td>
            {causes[i] && causes[i][0].name && <p>{causes[i][0].name}</p>}
            {causes[i] && (
              <pre>
                {causes[i][0].description ||
                  JSON.stringify(causes[i][0], null, 2)}
              </pre>
            )}
          </td>
          <td>{causes[i] && <code>{causes[i][1]}</code>}</td>
          <td>
            <time dateTime={e.time}>
              {e.time.slice(0, 19).replace("T", "\n")}
            </time>
          </td>
        </tr>
      ))}
    </table>
  </details>
);

const TestDetails: FunctionComponent<{
  activeSuite: TestSuiteResult;
  setActive: (item: DisplayItem) => void;
}> = ({ activeSuite, setActive }) =>
  "result" in activeSuite ? (
    <>
      {activeSuite.result.failure.length > 0 ? (
        <DisplayEvents
          rows={activeSuite.result.failure}
          setActive={setActive}
          title="Failing Events"
          causes={activeSuite.result.failCauses}
        />
      ) : undefined}
      {activeSuite.result.success.length > 0 ? (
        <DisplayEvents
          rows={activeSuite.result.success}
          setActive={setActive}
          title="Successful Events"
          causes={activeSuite.result.passCauses}
        />
      ) : undefined}
    </>
  ) : (
    <ul>
      {activeSuite.results.map((result) => (
        <li class={result.status}>
          <a onClick={() => setActive({ display: "testsuite", item: result })}>
            {result.test.name}
          </a>
        </li>
      ))}
    </ul>
  );

export const TestReport: FunctionComponent<{
  activeSuite: TestSuiteResult;
  setActive: (item: DisplayItem) => void;
}> = ({ activeSuite, setActive }) => (
  <>
    <details class="testreport" open>
      <summary class="testreport__title">
        Test Suite: {activeSuite.test.name}
      </summary>
      <p class="testreport__desc">{activeSuite.test.description}</p>
    </details>
    <TestDetails activeSuite={activeSuite} setActive={setActive} />
  </>
);
