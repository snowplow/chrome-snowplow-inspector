import { default as m, Component } from "mithril";
import {
  DisplayItem,
  IBeaconSummary,
  TestSuiteCondition,
  TestSuiteResult,
} from "../../ts/types";

const DisplayEvents: Component<{
  rows: IBeaconSummary[];
  setActive: (item: DisplayItem) => void;
  title: string;
  causes: [TestSuiteCondition, string?][];
}> = {
  view: ({ attrs: { rows, setActive, title, causes } }) =>
    m(
      ".card.tile.is-child",
      m("header.card-header", m("p.card-header-title", title)),
      m(
        ".card-content",
        m(
          "table.table.is-fullwidth",
          m(
            "tr",
            m("th", "Timestamp"),
            m("th", "Event Type"),
            m("th", "App ID"),
            m("th", "Collector"),
            m("th", "Condition"),
            m("th", "Actual"),
            m("th", "Event Method"),
            m("th", "Page")
          ),
          ...rows.map((e, i) =>
            m(
              "tr",
              m("td", m("time", { datetime: e.time }, e.time)),
              m(
                "td",
                m(
                  "a",
                  {
                    onclick: () => setActive({ display: "beacon", item: e }),
                  },
                  e.eventName
                )
              ),
              m("td", e.appId),
              m("td", e.collector),
              m(
                "td",
                causes[i] && m("pre", JSON.stringify(causes[i][0], null, 2))
              ),
              m("td", causes[i] && m("code", causes[i][1])),
              m("td", e.method),
              m("td", e.page)
            )
          )
        )
      )
    ),
};

const TestDetails: Component<{
  activeSuite: TestSuiteResult;
  setActive: (item: DisplayItem) => void;
}> = {
  view: ({ attrs: { activeSuite, setActive } }) =>
    "result" in activeSuite
      ? [
          activeSuite.result.failure.length
            ? m(DisplayEvents, {
                rows: activeSuite.result.failure,
                setActive,
                title: "Failing Events",
                causes: activeSuite.result.failCauses,
              })
            : undefined,
          activeSuite.result.success.length
            ? m(DisplayEvents, {
                rows: activeSuite.result.success,
                setActive,
                title: "Successful Events",
                causes: activeSuite.result.passCauses,
              })
            : undefined,
        ]
      : m(
          "ul",
          activeSuite.results.map((r) =>
            m(
              "li",
              { class: r.status },
              m(
                "a",
                { onclick: () => setActive({ display: "testsuite", item: r }) },
                r.test.name
              )
            )
          )
        ),
};

export const TestResults: Component<{
  activeSuite: TestSuiteResult;
  setActive: (item: DisplayItem) => void;
}> = {
  view: ({ attrs: { activeSuite, setActive } }) => [
    m(
      "div.level.box",
      m(
        "div.level-item.has-text-centered",
        m(
          "div",
          m("p.heading", "Test Suite"),
          m("p.title", activeSuite.test.name)
        )
      )
    ),
    m(
      "div.level.box",
      m(
        "div.level-item.has-text-centered",
        m(
          "div",
          m("p.heading", "Description"),
          m("p", activeSuite.test.description)
        )
      )
    ),
    m(TestDetails, { activeSuite, setActive }),
  ],
};
