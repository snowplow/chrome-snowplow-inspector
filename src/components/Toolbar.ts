import { Har } from "har-format";
import { default as m, Component, Vnode } from "mithril";
import { landingUrl } from "../ts/analytics";
import { IToolbar } from "../ts/types";

const toolbarView = (vnode: Vnode<IToolbar>) => {
  let toolbar_view;
  switch (vnode.attrs.application) {
    case "debugger":
      toolbar_view = [
        m(
          "a.button.is-outlined.is-small.control",
          { onclick: vnode.attrs.clearRequests },
          "Clear Events"
        ),
        m(
          "a.button.is-outlined.is-small.control",
          { onclick: () => vnode.attrs.changeApp("schemaManager") },
          "Manage Schemas"
        ),
        m(
          "a.button.is-outlined.is-small.control",
          { onclick: () => vnode.attrs.setModal("badRows") },
          "Import Bad Rows"
        ),
        m(
          "a.button.is-outlined.is-small.control",
          { onclick: () => vnode.attrs.setModal("stream") },
          "Stream Live Data"
        ),
        m(
          "a.button.is-outlined.is-small.control",
          {
            onclick: () => {
              const f = document.createElement("input") as HTMLInputElement;
              f.type = "file";
              f.multiple = true;
              f.accept = ".har";
              f.onchange = (change: Event) => {
                const files =
                  (change.target as HTMLInputElement).files || new FileList();

                for (let i = 0; i < files.length; i++) {
                  const file = files.item(i);

                  if (file !== null) {
                    const fr = new FileReader();

                    fr.addEventListener(
                      "load",
                      () => {
                        const content = JSON.parse(fr.result as string) as Har;
                        vnode.attrs.addRequests(content.log.entries);
                      },
                      false
                    );

                    fr.readAsText(file);
                  }
                }
              };
              f.click();
            },
          },
          "Import HAR Session"
        ),
      ];
      break;
    case "schemaManager":
      toolbar_view = [
        m(
          "a.button.is-outlined.is-small.control",
          { onclick: () => vnode.attrs.changeApp("debugger") },
          "Back to Debugger"
        ),
      ];
      break;
  }
  return toolbar_view;
};

export const Toolbar: Component<IToolbar> = {
  view: (vnode) =>
    m("nav.navbar.is-flex-touch", [
      m(
        "div.navbar-brand",
        m(
          "a.navbar-item",
          { href: landingUrl, target: "_blank" },
          m("img", { alt: "Poplin Data logo", src: "pd-logo.png" })
        )
      ),
      m(
        "div.navbar-menu.is-active.is-shadowless",
        m(
          "div.navbar-start",
          m("div.navbar-item.field.is-grouped", toolbarView(vnode))
        )
      ),
    ]),
};
