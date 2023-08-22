import { h, FunctionComponent } from "preact";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";

import { Registry, Resolver } from "../../ts/iglu";
import { ModalSetter } from "../../components/Modals";

import { Directory } from "./Directory";
import { RegistryList } from "./RegistryList";

import "./SchemaManager.scss";

type Filter = {
  search?: RegExp;
  selections: Registry[];
};

type SchemaManagerAttributes = {
  resolver: Resolver;
  setModal: ModalSetter;
};

export const SchemaManager: FunctionComponent<SchemaManagerAttributes> = ({
  resolver,
  setModal,
}) => {
  const [filters, setFilters] = useState<Filter>({
    search: undefined,
    selections: [],
  });

  const filterRegistries = useCallback(
    (selections: Registry[]) =>
      setFilters((filters) => ({ ...filters, selections })),
    [],
  );

  const clearSearch = useCallback(
    () => setFilters((filters) => ({ ...filters, search: undefined })),
    [],
  );

  const [collapsed, setCollapsed] = useState(true);

  const smRef = useRef<HTMLElement>(null);

  const filterBar = useMemo(
    () => (
      <div class="directory__filter">
        <input
          type="search"
          placeholder="Filter Pattern"
          title="Regular expression to search schemas for"
          onKeyUp={(event) => {
            const target = event.currentTarget;
            if (!target.value.trim()) return clearSearch();

            try {
              const re = new RegExp(target.value, "im");
              target.setCustomValidity("");
              setFilters((filters) => ({ ...filters, search: re }));
            } catch {
              target.setCustomValidity("Invalid regular expression");
              target.reportValidity();
            }
          }}
        />
        <button
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
    ),
    [clearSearch, collapsed, smRef],
  );

  return (
    <main class="app app--schema_manager schema_manager" ref={smRef}>
      <Directory setCollapsed={setCollapsed} resolver={resolver} {...filters}>
        {filterBar}
      </Directory>
      <RegistryList
        filterRegistries={filterRegistries}
        clearSearch={clearSearch}
        resolver={resolver}
        setModal={setModal}
        selectedRegistries={filters.selections}
      />
    </main>
  );
};
