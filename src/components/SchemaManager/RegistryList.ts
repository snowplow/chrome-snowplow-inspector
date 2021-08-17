import { default as m, ClosureComponent } from "mithril";
import { Registry, Resolver } from "../../ts/iglu";

import { ModalSetter } from "../../components/Modals";
import { LocalRegistry } from "../../ts/iglu/Registries/Local";

export const RegistryList: ClosureComponent<{
  clearSearch: () => void;
  resolver: Resolver;
  filterRegistries: (selected: Registry[]) => void;
  setModal: ModalSetter;
  requestUpdate: (request?: boolean) => boolean;
}> = (vnode) => {
  const {
    resolver,
    clearSearch,
    filterRegistries,
    setModal,
    requestUpdate,
    ...rest
  } = vnode.attrs;
  let selectedRegistries: Registry[] = [];

  const setRegistries = (registries: Registry[]) => {
    selectedRegistries = registries;
    filterRegistries(selectedRegistries);
  };

  return {
    view: () => {
      return m(
        "div.registries.column.is-narrow",
        m(resolver, { setRegistries, registries: selectedRegistries, ...rest }),
        m("menu", [
          m(
            "button.button.clear",
            {
              onclick: () => {
                setRegistries([]);
                clearSearch();
              },
            },
            "Clear Filters"
          ),
          m(
            "select.button.registries",
            {
              onchange: (event: InputEvent) => {
                if (event.target instanceof HTMLSelectElement) {
                  const callback = () => requestUpdate(true);
                  switch (event.target.value) {
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
                  event.target.selectedIndex = 0;
                }
              },
            },
            [
              m("option[selected][disabled]", "Registries..."),
              m("option", "Add"),
              m("option", "Edit"),
              m("option", "Import"),
              m("option", "Remove"),
            ]
          ),
          m(
            "button.button",
            {
              disabled: selectedRegistries.reduce((acc, reg) => {
                return acc && reg.spec.kind !== "local";
              }, true),
              onclick: (event: MouseEvent) => {
                if (event.target instanceof HTMLButtonElement) {
                  if (selectedRegistries)
                    setModal("editSchemas", {
                      registries: selectedRegistries.filter(
                        (reg) => reg.spec.kind === "local"
                      ),
                      callback: () => requestUpdate(true),
                    });
                }
              },
            },
            "Schemas..."
          ),
        ])
      );
    },
  };
};
