import { default as m, Component } from "mithril";

import { ModalOptions } from ".";
import { Registry, Resolver } from "../../ts/iglu";

export interface DeleteRegistriesOptions extends ModalOptions {
  registries: Registry[];
  resolver: Resolver;
}

export const DeleteRegistries: Component<DeleteRegistriesOptions, {}> = {
  view: ({ attrs: { setModal, registries, resolver } }) =>
    m("div.modal.is-active", [
      m("div.modal-background", { onclick: () => setModal() }),
      m("div.modal-card", [
        m("header.modal-card-head", [
          m("p.modal-card-title", "Delete Schema Registries"),
          m("button.delete", {
            onclick: () => setModal(),
          }),
        ]),
        m(
          "section.modal-card-body",
          m(
            "p",
            "You are about to remove the following registries from the extension. This can not be undone."
          ),
          m(
            "select[multiple][disabled]",
            { size: 5 },
            registries.map((reg) => m(reg))
          )
        ),
        m(
          "footer.modal-card-foot",
          m(
            "button.button.is-danger",
            {
              onclick: () => {
                const toRemove = registries.length;
                const removed = resolver.remove(...registries).length;
                console.assert(toRemove === removed);
                resolver.persist().then(() => setModal());
              },
            },
            "Yes, delete"
          )
        ),
      ]),
    ]),
};
