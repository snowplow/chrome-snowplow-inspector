import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/preact";
import { userEvent } from "@testing-library/user-event";

import { h } from "preact";

import { Toolbar } from "./Toolbar";
import type { Application, IToolbar } from "../ts/types";

const user = userEvent.setup();

describe("Toolbar", () => {
  const props: IToolbar = {
    application: "debugger",
    setApp: jest.fn(),
    setLogin: jest.fn(),
  };

  test.each(["Events", "Attributes", "Interventions"])("has %j tab", (name) => {
    render(<Toolbar {...props} />);

    expect(screen.getByRole("radio", { name })).toBeDefined();
  });

  test("changes tabs", async () => {
    render(<Toolbar {...props} />);

    const tabs: Record<Exclude<Application, "schemaManager">, string> = {
      // note: reverse order since clicking current tab is a no-op
      interventions: "Interventions",
      attributes: "Attributes",
      debugger: "Events",
    };

    for (const [app, name] of Object.entries(tabs)) {
      await user.click(screen.getByRole("radio", { name }));
      expect(props.setApp).toHaveBeenLastCalledWith(app);
    }
  });

  test("remembers collapsed state", async () => {
    render(<Toolbar {...props} />);

    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      { collapseToolbar: false },
      expect.any(Function),
    );

    expect(screen.queryByTitle("Expand toolbar")).toBeNull();
    expect(screen.queryByTitle("Collapse toolbar")).toBeDefined();

    await user.click(screen.getByTitle(/(Expand|Collapse) toolbar/));

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      collapseToolbar: true,
    });

    expect(screen.queryByTitle("Collapse toolbar")).toBeNull();
    expect(screen.queryByTitle("Expand toolbar")).toBeDefined();
  });
});
