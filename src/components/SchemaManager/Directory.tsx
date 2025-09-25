import { default as canonicalize } from "canonicalize";
import { h, type FunctionComponent } from "preact";
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
  type IgluUri,
} from "../../ts/iglu";
import { chunkEach, colorOf } from "../../ts/util";

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
  const seenRegs = new Map<IgluUri, Registry[]>();
  setCatalog([]);

  resolver.walk().then((discovered) => {
    setCatalog(discovered);

    setTimeout(() => {
      chunkEach(
        discovered,
        (ds, i) => {
          if (!seenRegs.has(ds.uri())) seenRegs.set(ds.uri(), []);
          if (signal.aborted) return Promise.resolve();

          return resolver
            .resolve(ds, seenRegs.get(ds.uri())!)
            .then((res) => {
              if (!signal.aborted)
                setCatalog((catalog) => ((catalog[i] = res), [...catalog]));
            })
            .catch(() => console.log("couldn't find ", ds.uri()));
        },
        undefined,
        signal,
      );
    }, 0);
  });
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

  const filtered = useMemo(
    () =>
      (selections.length || search
        ? catalog.filter((s) => {
            const filterHit =
              !selections.length ||
              (s instanceof ResolvedIgluSchema
                ? !!selections.find((r) => r.id === s.registry.id)
                : false);
            return filterHit && (!search || s.like(search));
          })
        : catalog
      ).sort((a, b) => {
        const ua = a.uri(),
          ub = b.uri();
        if (ua === ub) return 0;
        return ua < ub ? -1 : 1;
      }),
    [selections, search, catalog],
  );

  const directory: SchemaDirectory = useMemo(
    () =>
      filtered.reduce((acc, el) => {
        const v = (acc[el.vendor] = acc[el.vendor] || {});
        const n = (v[el.name] = v[el.name] || {});
        const f = (n[el.format] = n[el.format] || {});
        f[el.version] = f[el.version] || [];
        f[el.version].push(el);

        return acc;
      }, {} as SchemaDirectory),
    [filtered],
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
          <summary>{vendor}</summary>
          {Object.entries(schemas).map(([name, formats]) => (
            <details class="name" key={name}>
              <summary>{name}</summary>
              {Object.entries(formats).map(([format, versions]) => (
                <details class="format" key={format} open>
                  <summary>{format}</summary>
                  {Object.entries(versions).map(([version, deployments]) =>
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
                        ): [Registry[], IgluSchema | ResolvedIgluSchema] => [
                          registries,
                          deployments[i],
                        ],
                      )
                      .map(([registries, deployment]) => ({
                        val:
                          deployment instanceof ResolvedIgluSchema ? (
                            JSON.stringify(deployment.data, null, 4)
                          ) : (
                            <label>
                              Loading {deployment.uri()}&hellip; <progress />
                            </label>
                          ),
                        registries,
                      }))
                      .map(({ val, registries }) => (
                        <details class="version">
                          <summary>
                            {version}
                            {registries.map((r) => (
                              <span
                                class={[
                                  "registry",
                                  "is-pulled-right",
                                  colorOf(r.spec.id!),
                                ].join(" ")}
                              >
                                {r.spec.name}
                              </span>
                            ))}
                          </summary>
                          {typeof val === "string" ? (
                            <JsonViewer data={val} />
                          ) : (
                            val
                          )}
                        </details>
                      )),
                  )}
                </details>
              ))}
            </details>
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

function JsonViewer({ data }: { data: any }) {
  let parsedData;
  try{
    parsedData = JSON.parse(data)
  }catch(e){
    return null
  }
  const formatJson = (obj: any, indent = 0, keyPrefix = '') => {
    const currentIndent = "  ".repeat(indent)
    const childIndent = "  ".repeat(indent + 1)
    
    if (typeof obj === "object" && obj !== null) {
      if (Array.isArray(obj)) {
        const elements = [
          <span key={`${keyPrefix}bracket-open`} className="text-yellow-400">[</span>
        ]
        
        if (obj.length > 0) {
          obj.forEach((item, index) => {
            const itemKey = `${keyPrefix}item-${index}`
            elements.push(
              <br key={`${itemKey}-br`} />,
              <span key={`${itemKey}-indent`} className="text-muted-foreground">
                {childIndent}
              </span>,
              ...formatJson(item, indent + 1, itemKey)
            )
            
            if (index < obj.length - 1) {
              elements.push(
                <span key={`${itemKey}-comma`} className="text-foreground">,</span>
              )
            }
          })
          
          elements.push(
            <br key={`${keyPrefix}array-close-br`} />,
            <span key={`${keyPrefix}array-close-indent`} className="text-muted-foreground">
              {currentIndent}
            </span>
          )
        }
        
        elements.push(
          <span key={`${keyPrefix}bracket-close`} className="text-yellow-400">]</span>
        )
        
        return elements
      } else {
        const entries = Object.entries(obj)
        const elements = [
          <span key={`${keyPrefix}brace-open`} className="text-yellow-400">{"{"}</span>
        ]
        
        if (entries.length > 0) {
          entries.forEach(([key, value], index) => {
            const entryKey = `${keyPrefix}entry-${index}`
            elements.push(
              <br key={`${entryKey}-br`} />,
              <span key={`${entryKey}-indent`} className="text-muted-foreground">
                {childIndent}
              </span>,
              <span key={`${entryKey}-key`} className="text-blue-400">
                "{key}"
              </span>,
              <span key={`${entryKey}-colon`} className="text-foreground">
                : 
              </span>,
              ...formatJson(value, indent + 1, entryKey)
            )
            
            if (index < entries.length - 1) {
              elements.push(
                <span key={`${entryKey}-comma`} className="text-foreground">,</span>
              )
            }
          })
          
          elements.push(
            <br key={`${keyPrefix}object-close-br`} />,
            <span key={`${keyPrefix}object-close-indent`} className="text-muted-foreground">
              {currentIndent}
            </span>
          )
        }
        
        elements.push(
          <span key={`${keyPrefix}brace-close`} className="text-yellow-400">{"}"}</span>
        )
        
        return elements
      }
    }
    
    // Primitive values - return single element array
    if (typeof obj === "string") {
      return [
        <span key={`${keyPrefix}string`} className="text-green-400">
          "{obj}"
        </span>
      ]
    }
    
    if (typeof obj === "number") {
      return [
        <span key={`${keyPrefix}number`} className="text-orange-400">
          {obj}
        </span>
      ]
    }
    
    if (typeof obj === "boolean") {
      return [
        <span key={`${keyPrefix}boolean`} className="text-purple-400">
          {obj.toString()}
        </span>
      ]
    }
    
    if (obj === null) {
      return [
        <span key={`${keyPrefix}null`} className="text-red-400">
          null
        </span>
      ]
    }
    
    return []
  }

  return (
    <pre className="text-sm font-mono leading-relaxed">
      <code>{formatJson(parsedData, 0, 'root')}</code>
    </pre>
  )
}