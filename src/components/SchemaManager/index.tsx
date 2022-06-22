import { h, FunctionComponent } from "preact";
import { useRef, useState } from "preact/hooks";

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

export const SchemaManager: FunctionComponent<SchemaManagerAttributes> = (
  props
) => {
  const [filters, setFilters] = useState<Filter>({
    search: undefined,
    selections: [],
  });

  const filterRegistries = (selections: Registry[]) =>
    setFilters((filters) => ({ ...filters, selections }));

  const clearSearch = () =>
    setFilters((filters) => ({ ...filters, search: undefined }));

  const [doUpdate, setDoUpdate] = useState(false);

  const requestUpdate = (request?: boolean): boolean => {
    if (typeof request === "undefined") return doUpdate;
    setDoUpdate(request);
    return request;
  };

  const [collapsed, setCollapsed] = useState(true);

  const smRef = useRef<HTMLElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  return (
    <section class="schema-manager columns section" ref={smRef}>
      <Directory
        requestUpdate={requestUpdate}
        setCollapsed={setCollapsed}
        {...filters}
        {...props}
      >
        <div class="field is-grouped filterPanel">
          <input
            class="input"
            type="search"
            placeholder="Filter Pattern"
            title="Regular expression to search schemas for"
            onKeyUp={() => {
              const target = filterRef.current;
              if (target) {
                const val = target.value;
                if (!val.trim()) return clearSearch();

                try {
                  const re = new RegExp(val, "im");
                  target.setCustomValidity("");
                  filters.search = re;
                } catch {
                  target.setCustomValidity("Invalid regular expression");
                  target.reportValidity();
                }
              }
            }}
            ref={filterRef}
          />
          <button
            class="button"
            onClick={() => {
              if (smRef.current) {
                const details = smRef.current.getElementsByTagName("details");
                Array.from(details).forEach((det) => (det.open = collapsed));
                setCollapsed((collapsed) => !collapsed);
              }
            }}
          >
            {collapsed ? "Expand All" : "Collapse All"}
          </button>
        </div>
      </Directory>
      <RegistryList
        filterRegistries={filterRegistries}
        clearSearch={clearSearch}
        requestUpdate={requestUpdate}
        {...props}
      />
    </section>
  );
};
