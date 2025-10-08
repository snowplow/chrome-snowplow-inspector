import { h, type FunctionComponent } from "preact";
import {
  useCallback,
  useErrorBoundary,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { errorAnalytics } from "../../ts/analytics";
import { type Registry, Resolver } from "../../ts/iglu";
import { type ModalSetter } from "../../components/Modals";

import { Directory } from "./Directory";
import { RegistryList } from "./RegistryList";

import "./SchemaManager.css";

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
  useErrorBoundary(errorAnalytics);
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
      <div className="directory__filter mb-2">
        <input
          className="w-full px-2 py-2 bg-[#191919] border-none text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-white focus:border-transparent"
          type="search"
          placeholder="Filter Pattern"
          title="Regular expression to search schemas for"
          onInput={({ currentTarget }) => {
            if (!currentTarget.value.trim()) return clearSearch();

            try {
              const re = new RegExp(currentTarget.value, "im");
              currentTarget.setCustomValidity("");
              setFilters((filters) => ({ ...filters, search: re }));
            } catch {
              currentTarget.setCustomValidity("Invalid regular expression");
              currentTarget.reportValidity();
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
    <main class="app app--schema_manager schema_manager px-4 py-2" ref={smRef}>
      <Directory setCollapsed={setCollapsed} resolver={resolver} {...filters}>
        {filterBar}
        <RegistryList
          filterRegistries={filterRegistries}
          clearSearch={clearSearch}
          resolver={resolver}
          setModal={setModal}
          selectedRegistries={filters.selections}
        />
      </Directory>
    </main>
  );
};
