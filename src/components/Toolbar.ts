import * as har from "har-format";
import m = require("mithril");
import analytics = require("../ts/analytics");
import { IToolbar } from "../ts/types";
import validator = require("../ts/validator");

export = {
  view: (vnode: m.Vnode<IToolbar>) =>
    m("nav.navbar.is-flex-touch", [
      m(
        "div.navbar-brand",
        m(
          "a.navbar-item",
          { href: analytics.landingUrl, target: "_blank" },
          m("img", { alt: "Poplin Data logo", src: "pd-logo.png" })
        )
      ),
      m(
        "div.navbar-menu.is-active.is-shadowless",
        m(
          "div.navbar-start",
          m("div.navbar-item.field.is-grouped", [
            m(
              "a.button.is-outlined.is-small.control",
              { onclick: () => vnode.attrs.changeApp("schemaManager") },
              "Manage Schemas"
            ),
            m(
              "a.button.is-outlined.is-small.control",
              { onclick: vnode.attrs.clearRequests },
              "Clear Events"
            ),
            m(
              "a.button.is-outlined.is-small.control",
              { onclick: validator.clearCache },
              "Clear Schema Cache"
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
                      (change.target as HTMLInputElement).files ||
                      new FileList();

                    for (let i = 0; i < files.length; i++) {
                      const file = files.item(i);

                      if (file !== null) {
                        const fr = new FileReader();

                        fr.addEventListener(
                          "load",
                          () => {
                            const content = JSON.parse(
                              fr.result as string
                            ) as har.Har;
                            vnode.attrs.addRequests(
                              file.name,
                              content.log.entries
                            );
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
          ])
        )
      ),
    ]),
};
