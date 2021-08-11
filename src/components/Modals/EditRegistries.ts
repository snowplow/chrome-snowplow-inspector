import { default as m, Component, Vnode } from "mithril";

import { ModalOptions } from ".";
import { buildRegistry, Registry, Resolver } from "../../ts/iglu";
import { RegistrySpec } from "../../ts/types";

export interface EditRegistriesOptions extends ModalOptions {
  registries: Registry[];
  resolver: Resolver;
}

const modelRegistries = (form: HTMLFormElement, existing: Registry[]) =>
  Array.from(form.elements)
    .filter(
      (field): field is HTMLFieldSetElement =>
        field instanceof HTMLFieldSetElement
    )
    .reduce<RegistrySpec[]>((acc, fs) => {
      const options = Array.from(fs.elements);
      const oldspec = existing.find((reg) => reg.id === fs.name);
      const specTempl: RegistrySpec = oldspec
        ? oldspec.spec
        : {
            id: fs.name,
            kind: "local",
            name: "",
          };

      const spec: RegistrySpec = options.reduce((acc, opt) => {
        if (
          opt instanceof HTMLInputElement ||
          opt instanceof HTMLTextAreaElement ||
          opt instanceof HTMLSelectElement
        ) {
          if (opt instanceof HTMLTextAreaElement) {
            acc[opt.name] = opt.value ? opt.value.split("\n") : [];
          } else if (opt.type === "number") {
            acc[opt.name] = opt.value ? parseFloat(opt.value) : undefined;
          } else {
            acc[opt.name] = opt.value || undefined;
          }
        }
        return acc;
      }, specTempl);

      acc.push(spec);
      return acc;
    }, [])
    .map(buildRegistry);

export const EditRegistries: Component<
  EditRegistriesOptions,
  { editing: Registry[] }
> = {
  view: ({ attrs: { setModal, registries, resolver }, state }) =>
    m("div.modal.is-active", [
      m("div.modal-background", { onclick: () => setModal() }),
      m("div.modal-card", [
        m("header.modal-card-head", [
          m("p.modal-card-title", "Edit Schema Registry"),
          m("button.delete", {
            onclick: () => setModal(),
          }),
        ]),
        m(
          "section.modal-card-body",
          m(
            "form#edit-registries.form.registry-definition",
            {
              oninit: () => {
                state.editing = registries.map((reg) =>
                  buildRegistry({ ...reg.spec, ...reg.opts, id: reg.id })
                );
              },
              onchange: (event: Event) => {
                if (!(event.currentTarget instanceof HTMLFormElement)) return;
                if (
                  event.currentTarget.getAttribute("id") !== "edit-registries"
                )
                  return;

                const form = event.currentTarget;
                state.editing = modelRegistries(form, state.editing);
              },
              onsubmit: (event: Event) => {
                if (!(event.target instanceof HTMLFormElement)) return;
                if (event.target.getAttribute("id") !== "edit-registries")
                  return;
                event.stopPropagation();
                event.preventDefault();

                const form = event.target;

                if (!form.checkValidity()) {
                  form.reportValidity();
                  return;
                }

                resolver.import(true, ...modelRegistries(form, state.editing));
                setModal();
              },
            },
            (state.editing || registries).map((reg) =>
              m(reg, { editing: true })
            )
          )
        ),
        m(
          "footer.modal-card-foot",
          m("button.button[form=edit-registries]", "Save Registries")
        ),
      ]),
    ]),
};
