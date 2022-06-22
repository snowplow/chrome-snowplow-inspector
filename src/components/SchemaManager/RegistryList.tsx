import { h, FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { Registry, Resolver } from "../../ts/iglu";

import { ModalSetter } from "../../components/Modals";
import { LocalRegistry } from "../../ts/iglu/Registries/Local";
import { ResolverListing } from "./ResolverListing";

export const RegistryList: FunctionComponent<{
  clearSearch: () => void;
  resolver: Resolver;
  filterRegistries: (selected: Registry[]) => void;
  setModal: ModalSetter;
  requestUpdate: (request?: boolean) => boolean;
}> = ({
  resolver,
  clearSearch,
  filterRegistries,
  setModal,
  requestUpdate,
  ...rest
}) => {
  const [selectedRegistries, setSelectedRegistries] = useState<Registry[]>([]);

  const setRegistries = (registries: Registry[]) => {
    setSelectedRegistries(registries);
    filterRegistries(registries);
  };

  return (
    <div class="registries column is-narrow">
      <ResolverListing resolver={resolver} selectRegistries={setRegistries} />
      <menu>
        <button
          class="button clear"
          onClick={() => (setRegistries([]), clearSearch())}
        >
          Clear Filters
        </button>
        <select
          class="button registries"
          onChange={(event) => {
            const target = event.currentTarget;

            const callback = () => requestUpdate(true);
            switch (target.value) {
              case "Edit":
                if (selectedRegistries)
                  setModal("editRegistries", {
                    registries: selectedRegistries,
                    resolver,
                    callback,
                  });
                break;
              case "Add":
                const newReg = new LocalRegistry({
                  kind: "local",
                  name: "My New Registry",
                });
                setModal("editRegistries", {
                  registries: [newReg],
                  resolver,
                  callback,
                });
                break;
              case "Remove":
                if (selectedRegistries)
                  setModal("deleteRegistries", {
                    registries: selectedRegistries,
                    resolver,
                    callback,
                  });

                setRegistries([]);
                clearSearch();
                break;
              case "Import":
                setModal("importRegistries", { resolver, callback });
                break;
            }
            target.selectedIndex = 0;
          }}
        >
          <option selected disabled>
            Registries...
          </option>
          <option>Add</option>
          <option disabled={selectedRegistries.length === 0}>Edit</option>
          <option>Import</option>
          <option disabled={selectedRegistries.length === 0}>Remove</option>
        </select>
        <button
          class="button"
          disabled={
            !selectedRegistries.some((reg) => reg.spec.kind !== "local")
          }
          onClick={() => {
            if (selectedRegistries.length) {
              setModal("editSchemas", {
                registries: selectedRegistries.filter(
                  (reg) => reg.spec.kind === "local"
                ),
                callback: () => requestUpdate(true),
              });
            }
          }}
        >
          Schemas...
        </button>
      </menu>
    </div>
  );
};
