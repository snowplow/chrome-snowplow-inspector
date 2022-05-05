import { Har } from "har-format";
import { request } from "http";
import { default as m, Component, Vnode } from "mithril";
import { landingUrl } from "../ts/analytics";
import { IToolbar, NgrokEvent } from "../ts/types";
import { ngrokEventToHAR, parseNgrokRequests } from "../ts/util";
import { request as requestPerms } from "../ts/permissions";

let ngrokStreamLock: number = -1;
let ngrokStreamInterval: number = 1000;

const toolbarView = (vnode: Vnode<IToolbar>) => {
  let toolbar_view;
  var ngrok_watermark = 0;
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
          {
            onclick: () =>
              vnode.attrs.setModal("badRows", {
                addRequests: vnode.attrs.addRequests,
              }),
          },
          "Import Bad Rows"
        ),
        m(
          "a.button.is-outlined.is-small.control",
          {
            onclick: () =>
              vnode.attrs.setModal("stream", {
                addRequests: vnode.attrs.addRequests,
              }),
          },
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
        m(
          "a.button.is-outlined.is-small.control",
          {
            class: ngrokStreamLock === -1 ? "ngrok-play" : "ngrok-stop"
          },
          m("hi", {
            onclick: () => {
            if (ngrokStreamLock != -1) {
              console.log('stopping ngrok stream');
              ngrokStreamLock = -1;
              return;
            }

            // this permissions things works but it needs a better way
            // to test and reset it!

            var API_HOST = 'http://localhost:4040/'; // TODO: make this customisable in settings

            requestPerms(API_HOST).then(() => {
              let timeoutId = window.setTimeout(function pollStream() {
                console.log('requesting new data...');
                let newEntries = fetch(`${API_HOST}api/requests/http`, {
                  headers: {
                    'Accept': 'application/json'
                  }
                })
                  .then((response) => response.json())
                  // and then?
                  .then(parseNgrokRequests)
                  // and then and then
                  .then(({entries}) => vnode.attrs.addRequests(entries));

                  if (ngrokStreamLock === timeoutId) {
                    ngrokStreamLock = timeoutId = window.setTimeout(
                      pollStream,
                      ngrokStreamInterval
                    );
                  }

              }, ngrokStreamInterval);
              ngrokStreamLock = timeoutId;
            });
            },
          },
          ngrokStreamLock === -1 ? 'Start ngrok listener' : 'Stop ngrok listener'
        )),
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
