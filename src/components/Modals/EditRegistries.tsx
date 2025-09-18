import { h, type FunctionComponent } from "preact";
import {
  type Dispatch,
  type StateUpdater,
  useEffect,
  useState,
} from "preact/hooks";

import type { ModalOptions } from ".";
import { BaseModal } from "./BaseModal";
import { buildRegistry, type Registry, Resolver } from "../../ts/iglu";
import { RegistryDetail } from "../SchemaManager/RegistryDetail";
import type { RegistrySpec } from "../../ts/types";

export interface EditRegistriesOptions extends ModalOptions {
  registries: Registry[];
  resolver: Resolver;
}

const checkRegistries = (
  existing: Registry[],
  setCounts: Dispatch<StateUpdater<number[]>>,
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
        buildRegistry({ ...reg.spec, ...reg.opts, id: reg.id }),
      ),
    );
  }, [registries]);

  useEffect(() => void checkRegistries(editing, setCounts), [editing]);

  return (
    <BaseModal
      title="Edit Schema Registry"
      onClose={setModal}
      onChange={({ currentTarget }) => {
        const modelled = modelRegistries(currentTarget, editing);
        setEditing(modelled);
        if (currentTarget.checkValidity()) checkRegistries(modelled, setCounts);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const { currentTarget } = event;
        if (currentTarget.reportValidity()) {
          resolver.import(true, ...modelRegistries(currentTarget, editing));
          resolver.persist().then(() => setModal());
        }
      }}
    >
      <section>
        {editing.map((reg, i) => (
          <RegistryDetail registry={reg} editing schemaCount={counts[i]} />
        ))}
      </section>
      <footer>
        <button>Save Registries</button>
      </footer>
    </BaseModal>
  );
};
