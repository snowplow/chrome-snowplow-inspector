import { default as m, Component, Vnode } from "mithril";

import { ModalOptions } from ".";
import { Registry } from "../../ts/iglu";

export interface EditSchemasOptions extends ModalOptions {
  registries: Registry[];
}

export const EditSchemas: Component<EditSchemasOptions> = {
  oninit: ({ attrs: { registries } }) => {
    registries.map((reg, i) =>
      reg.walk().then((schemas) => {
        console.log(schemas);
      })
    );
  },
  view: ({ attrs: { setModal } }) =>
    m("div.modal.is-active", [
      m("div.modal-background", { onclick: () => setModal() }),
      m("div.modal-card", [
        m("header.modal-card-head", [
          m("p.modal-card-title", "Edit Local Schemas"),
          m("button.delete", {
            onclick: () => setModal(),
          }),
        ]),
        m(
          "section.modal-card-body",
          m("form#edit-schemas.form.schemas-definition")
        ),
        m(
          "footer.modal-card-foot",
          m("button.button[form=edit-schemas]", "Save Schemas")
        ),
      ]),
    ]),
};
