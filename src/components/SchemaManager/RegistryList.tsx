import { h, FunctionComponent } from "preact";
import { StateUpdater } from "preact/hooks";

import { Registry, Resolver } from "../../ts/iglu";

import { ModalSetter } from "../../components/Modals";
import { LocalRegistry } from "../../ts/iglu/Registries/Local";
import { ResolverListing } from "./ResolverListing";

export const RegistryList: FunctionComponent<{
  clearSearch: () => void;
  resolver: Resolver;
  filterRegistries: (selected: Registry[]) => void;
  setModal: ModalSetter;
  selectedRegistries: Registry[];
}> = ({
  resolver,
  clearSearch,
  filterRegistries,
  setModal,
  selectedRegistries,
}) => (
  <div class="registry_list">
    <ResolverListing
      resolver={resolver}
      selected={selectedRegistries}
      selectRegistries={filterRegistries}
    />
    <menu>
      <button onClick={() => (filterRegistries([]), clearSearch())}>
        Clear Filters
      </button>
      <select
        class="button"
        onChange={(event) => {
          const target = event.currentTarget;

          switch (target.value) {
            case "Edit":
              if (selectedRegistries.length)
                setModal("editRegistries", {
                  registries: selectedRegistries,
                  resolver,
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
              });
              break;
            case "Remove":
              if (selectedRegistries.length)
                setModal("deleteRegistries", {
                  registries: selectedRegistries,
                  resolver,
                });

              filterRegistries([]);
              clearSearch();
              break;
            case "Import":
              setModal("importRegistries", { resolver });
              break;
          }
          target.selectedIndex = 0;
        }}
      >
        <option selected hidden>
          Registries...
        </option>
        <option>Add</option>
        <option disabled={selectedRegistries.length === 0}>Edit</option>
        <option>Import</option>
        <option disabled={selectedRegistries.length === 0}>Remove</option>
      </select>
      <button
        disabled={
          !selectedRegistries.length ||
          selectedRegistries.some((reg) => reg.spec.kind !== "local")
        }
        onClick={() => {
          if (selectedRegistries.length) {
            setModal("editSchemas", {
              registries: selectedRegistries.filter(
                (reg) => reg.spec.kind === "local",
              ),
            });
          }
        }}
      >
        Schemas...
      </button>
    </menu>
  </div>
);
