import { default as m, Vnode } from "mithril";
import { Registry, Resolver } from "../../ts/iglu";

export const RegistryList = (
  vnode: Vnode<{
    resolver: Resolver;
    selectRegistries: (selected: Registry[]) => void;
  }>
) => {
  const { resolver, ...rest } = vnode.attrs;
  let shouldClear = false;
  const setClear = (should: boolean) => (shouldClear = should);
  return {
    view: () => {
      return m(
        "div.registries.column.is-narrow",
        m(resolver, { shouldClear, setClear, ...rest }),
        m("menu", [
          m(
            "button.clear",
            {
              onclick: () => {
                shouldClear = true;
              },
            },
            "Clear Selection"
          ),
          m(
            "select.registries",
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
            "select.schemas",
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
              m("option", "Edit"),
              m("option", "Remove"),
            ]
          ),
        ])
      );
    },
  };
};
