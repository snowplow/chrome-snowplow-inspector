import { h, FunctionComponent, Fragment } from "preact";

import {
  DisplayItem,
  IBeaconSummary,
  TestSuiteCondition,
  TestSuiteResult,
} from "../../ts/types";

const DisplayEvents: FunctionComponent<{
  rows: IBeaconSummary[];
  setActive: (item: DisplayItem) => void;
  title: string;
  causes: [TestSuiteCondition, string?][];
}> = ({ rows, setActive, title, causes }) => (
  <div class="card tile is-child">
    <header class="cart-header">
      <p class="card-header-title">{title}</p>
    </header>
    <div class="card-content">
      <table class="table is-fullwidth">
        <tr>
          <th>Timestamp</th>
          <th>Event Type</th>
          <th>App ID</th>
          <th>Collector</th>
          <th>Condition</th>
          <th>Actual</th>
          <th>Event Method</th>
          <th>Page</th>
        </tr>
        {rows.map((e, i) => (
          <tr>
            <td>
              <time dateTime={e.time}>{e.time}</time>
            </td>
            <td>
              <a onClick={() => setActive({ display: "beacon", item: e })}>
                {e.eventName}
              </a>
            </td>
            <td>{e.appId}</td>
            <td>{e.collector}</td>
            <td>
              {causes[i] && <pre>{JSON.stringify(causes[i][0], null, 2)}</pre>}
            </td>
            <td>{causes[i] && <code>{causes[i][1]}</code>}</td>
            <td>{e.method}</td>
            <td>{e.page}</td>
          </tr>
        ))}
      </table>
    </div>
  </div>
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

export const TestResults: FunctionComponent<{
  activeSuite: TestSuiteResult;
  setActive: (item: DisplayItem) => void;
}> = ({ activeSuite, setActive }) => (
  <>
    <div class="level box">
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Test Suite</p>
          <p class="title">{activeSuite.test.name}</p>
        </div>
      </div>
    </div>
    <div class="level box">
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Description</p>
          <p class="title">{activeSuite.test.description}</p>
        </div>
      </div>
    </div>
    <TestDetails activeSuite={activeSuite} setActive={setActive} />
  </>
);
