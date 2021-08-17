import { default as m, ClosureComponent, VnodeDOM } from "mithril";

import { Registry, Resolver } from "../../ts/iglu";
import { ModalSetter } from "../../components/Modals";

import { Directory } from "./Directory";
import { RegistryList } from "./RegistryList";

type Filter = {
  search?: RegExp;
  selections: Registry[];
};

type SchemaManagerAttributes = {
  resolver: Resolver;
  setModal: ModalSetter;
};

export const SchemaManager: ClosureComponent<SchemaManagerAttributes> = () => {
  const filters: Filter = {
    search: undefined,
    selections: [],
  };

  const filterRegistries = (selected: Registry[]) =>
    (filters.selections = selected);

  const clearSearch = () => (filters.search = undefined);

  let doUpdate = false;
  const requestUpdate = (request?: boolean): boolean => {
    if (typeof request === "undefined") return doUpdate;
    return (doUpdate = request);
  };

  let collapsed = true;

  return {
    view: (vnode) =>
      m(
        "section.schema-manager.columns.section",
        m(
          Directory,
          {
            ...filters,
            requestUpdate,
            setCollapsed: (c) => (collapsed = c),
            ...vnode.attrs,
          },
          m(
            ".field.is-grouped.filterPanel",
            m("input.input[search]", {
              placeholder: "Filter Pattern",
              title: "Regular expression to search schemas for",
              onkeyup: (event: KeyboardEvent) => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) return;
                const val = target.value;
                if (!val.trim()) return (filters.search = undefined);

                try {
                  const re = new RegExp(val, "im");
                  target.setCustomValidity("");
                  filters.search = re;
                } catch {
                  target.setCustomValidity("Invalid regular expression");
                  target.reportValidity();
                }
              },
            }),
            m(
              "button.button",
              {
                onclick: () => {
                  if ("dom" in vnode) {
                    const details = (
                      vnode as VnodeDOM<SchemaManagerAttributes>
                    ).dom.querySelectorAll("details");

                    Array.prototype.forEach.call(details, (det) => {
                      if (det instanceof HTMLDetailsElement) {
                        det.open = collapsed;
                      }
                    });

                    collapsed = !collapsed;
                  }
                },
              },
              collapsed ? "Expand All" : "Collapse All"
            )
          )
        ),
        m(RegistryList, {
          filterRegistries,
          clearSearch,
          requestUpdate,
          ...vnode.attrs,
        })
      ),
  };
};
