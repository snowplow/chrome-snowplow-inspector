import { default as canonicalize } from "canonicalize";
import { h, type FunctionComponent, type ComponentChildren } from "preact";
import {
  type Dispatch,
  type StateUpdater,
  useEffect,
  useMemo,
  useState,
} from "preact/hooks";

import {
  type Registry,
  IgluSchema,
  ResolvedIgluSchema,
  Resolver,
} from "../../ts/iglu";
import { chunkEach, colorOf } from "../../ts/util";

import { JsonViewer } from "../JSONViewer";

interface SchemaDirectory {
  [vendor: string]: VendorDirectory;
}

interface VendorDirectory {
  [name: string]: NameDirectory;
}

interface NameDirectory {
  [format: string]: VersionDirectory;
}

interface VersionDirectory {
  [version: string]: (IgluSchema | ResolvedIgluSchema)[];
}

type DirectoryAttrs = {
  resolver: Resolver;
  search?: RegExp;
  selections: Registry[];
  setCollapsed: Dispatch<StateUpdater<boolean>>;
};

const refreshSchemas = (
  resolver: Resolver,
  setCatalog: Dispatch<StateUpdater<(IgluSchema | ResolvedIgluSchema)[]>>,
  signal: AbortSignal,
) => {
  setCatalog([]);

  resolver.walk().then((discovered) => {
    discovered.sort((a, b) => {
      const ua = a.uri(),
        ub = b.uri();
      if (ua === ub) return 0;
      return ua < ub ? -1 : 1;
    });

    setCatalog(discovered);

    chunkEach(
      discovered,
      (ds) => {
        if (signal.aborted) return Promise.reject();
        return resolver.resolve(ds);
      },
      setCatalog,
      undefined,
      signal,
    );
  });
};

const LazyDisplay: FunctionComponent<{
  content: () => ComponentChildren;
  deps?: any[];
  name: string;
  initOpen?: boolean;
}> = ({ children, content, deps = [], name, initOpen = false }) => {
  const [open, setOpen] = useState(initOpen);
  const viewer = useMemo(content, deps);

  return (
    <details
      class={name}
      open={open}
      onToggle={({ currentTarget }) => setOpen(currentTarget.open)}
    >
      <summary>{children}</summary>
      {open ? viewer : null}
    </details>
  );
};

export const Directory: FunctionComponent<DirectoryAttrs> = ({
  search,
  selections,
  resolver,
  setCollapsed,
  children,
}) => {
  const [catalog, setCatalog] = useState<(IgluSchema | ResolvedIgluSchema)[]>(
    [],
  );

  useEffect(() => {
    const aborter = new AbortController();
    refreshSchemas(resolver, setCatalog, aborter.signal);
    return () => aborter.abort();
  }, [resolver, ...resolver.registries]);

  const directory: SchemaDirectory = useMemo(
    () =>
      catalog.reduce((acc: SchemaDirectory, el) => {
        if (selections.length) {
          if (
            !(el instanceof ResolvedIgluSchema) ||
            !selections.some((r) => r.id === el.registry.id)
          )
            return acc;
        }

        if (search && !el.like(search)) {
          return acc;
        }

        const v = (acc[el.vendor] = acc[el.vendor] || {});
        const n = (v[el.name] = v[el.name] || {});
        const f = (n[el.format] = n[el.format] || {});
        f[el.version] = f[el.version] || [];
        f[el.version].push(el);

        return acc;
      }, {}),
    [selections, search, catalog],
  );

  const listings = useMemo(
    () =>
      Object.entries(directory).map(([vendor, schemas]) => (
        <details
          class={vendor}
          open
          key={vendor}
          onClick={(event: Event) => {
            if (
              event.target instanceof HTMLElement &&
              event.eventPhase == Event.BUBBLING_PHASE
            ) {
              if (event.target instanceof HTMLDetailsElement) {
                setCollapsed(event.target.open);
                event.stopPropagation();
              } else if (
                event.target.parentNode instanceof HTMLDetailsElement
              ) {
                setCollapsed(event.target.parentNode.open);
                event.stopPropagation();
              }
            }
          }}
        >
          <summary key="_summary">{vendor}</summary>
          {Object.entries(schemas).map(([name, formats]) => (
            <LazyDisplay
              key={name}
              name="name"
              deps={[directory]}
              content={() =>
                Object.entries(formats).map(([format, versions]) => (
                  <LazyDisplay
                    key={format}
                    name="format"
                    initOpen
                    deps={[directory]}
                    content={() =>
                      Object.entries(versions).map(([version, deployments]) =>
                        deployments
                          .map((d) =>
                            d instanceof ResolvedIgluSchema
                              ? canonicalize(d.data) || JSON.stringify(d.data)
                              : d.uri(),
                          )
                          .map((d, _, a) => a.indexOf(d))
                          .reduce<Registry[][]>((canon, e, i) => {
                            const s = deployments[i];
                            canon[e] = canon[e] || [];
                            if (s instanceof ResolvedIgluSchema) {
                              canon[e].push(s.registry);
                            }

                            return canon;
                          }, [])
                          .map(
                            (
                              registries,
                              i,
                            ): [
                              Registry[],
                              IgluSchema | ResolvedIgluSchema,
                            ] => [registries, deployments[i]],
                          )
                          .map(([registries, deployment]) => ({
                            val:
                              deployment instanceof ResolvedIgluSchema ? (
                                [deployment.data]
                              ) : (
                                <label>
                                  Loading {deployment.uri()}&hellip;{" "}
                                  <progress />
                                </label>
                              ),
                            registries,
                          }))
                          .map(({ val, registries }, i) => (
                            <LazyDisplay
                              key={i}
                              content={() =>
                                Array.isArray(val) ? (
                                  <JsonViewer data={val[0]} />
                                ) : (
                                  val
                                )
                              }
                              name="version"
                              deps={[directory]}
                            >
                              {version}
                              {registries.map((r) => (
                                <span
                                  class={["registry", colorOf(r.spec.id!)].join(
                                    " ",
                                  )}
                                >
                                  {r.spec.name}
                                </span>
                              ))}
                            </LazyDisplay>
                          )),
                      )
                    }
                  >
                    {format}
                  </LazyDisplay>
                ))
              }
            >
              {name}
            </LazyDisplay>
          ))}
        </details>
      )),
    [directory],
  );

  return (
    <div class="directory p-1 flex flex-col">
      {children}
      <div className="overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        {listings}
      </div>
    </div>
  );
};
