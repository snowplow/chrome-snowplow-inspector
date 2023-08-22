import { h, FunctionComponent } from "preact";
import { StateUpdater, useEffect, useState } from "preact/hooks";

import { ModalOptions } from ".";
import { buildRegistry, Registry, Resolver } from "../../ts/iglu";
import { RegistryDetail } from "../SchemaManager/RegistryDetail";
import { RegistrySpec } from "../../ts/types";

export interface EditRegistriesOptions extends ModalOptions {
  registries: Registry[];
  resolver: Resolver;
}

const checkRegistries = (
  existing: Registry[],
  setCounts: StateUpdater<number[]>,
) =>
  Promise.all(
    existing.map((r, i) =>
      r
        .status()
        .then(() => r.walk())
        .then(
          (x) => length,
          () => 0,
        ),
    ),
  ).then(setCounts);

const modelRegistries = (form: HTMLFormElement, existing: Registry[]) =>
  Array.from(form.elements)
    .filter(
      (field): field is HTMLFieldSetElement =>
        field instanceof HTMLFieldSetElement,
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

export const EditRegistries: FunctionComponent<EditRegistriesOptions> = ({
  setModal,
  registries,
  resolver,
}) => {
  const [editing, setEditing] = useState<Registry[]>([]);
  const [counts, setCounts] = useState<number[]>([]);

  useEffect(() => {
    setEditing(
      registries.map((reg) =>
        buildRegistry({ ...reg.spec, ...reg.opts, id: reg.id })
      )
    );
  }, [registries]);

  useEffect(() => void checkRegistries(editing, setCounts), [editing]);

  return (
    <div class="modal is-active">
      <div class="modal-background" onClick={() => setModal()}></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Edit Schema Registry</p>
          <button class="delete" onClick={() => setModal()} />
        </header>
        <section class="modal-card-body">
          <form
            id="edit-registries"
            class="form registry-definition"
            onChange={(event) => {
              const target = event.currentTarget;

              const modelled = modelRegistries(target, editing);
              setEditing(modelled);
              if (target.checkValidity()) checkRegistries(modelled, setCounts);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();

              const target = event.currentTarget;
              if (target.reportValidity()) {
                resolver.import(true, ...modelRegistries(target, editing));
                resolver.persist().then(() => setModal());
              }
            }}
          >
            {editing.map((reg, i) => (
              <RegistryDetail registry={reg} editing schemaCount={counts[i]} />
            ))}
          </form>
        </section>
        <footer class="modal-card-foot">
          <button class="button" form="edit-registries">
            Save Registries
          </button>
        </footer>
      </div>
    </div>
  );
};
