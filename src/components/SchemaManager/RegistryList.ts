import { default as m, Vnode } from "mithril";
import { Registry, Resolver } from "../../ts/iglu";

export const RegistryList = (
  vnode: Vnode<{
    clearSearch: () => void;
    resolver: Resolver;
    filterRegistries: (selected: Registry[]) => void;
  }>
) => {
  const { resolver, clearSearch, filterRegistries, ...rest } = vnode.attrs;
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
            "select.button.schemas",
            {
              onchange: (event: InputEvent) => {
                if (event.target instanceof HTMLSelectElement) {
                  event.target.selectedIndex = 0;
                }
              },
            },
            [
              m("option[selected][disabled]", "Schemas..."),
              m("option", "Add"),
              m("option", "Compare"),
            ]
          ),
        ])
      );
    },
  };
};
