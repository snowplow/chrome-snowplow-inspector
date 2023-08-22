import { default as canonicalize } from "canonicalize";
import { h, FunctionComponent } from "preact";
import { StateUpdater, useEffect, useMemo, useState } from "preact/hooks";

import {
  Registry,
  IgluSchema,
  ResolvedIgluSchema,
  Resolver,
  IgluUri,
} from "../../ts/iglu";
import { chunkEach, colorOf, sorted } from "../../ts/util";

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
  setCollapsed: StateUpdater<boolean>;
  watermark: number;
};

const refreshSchemas = (
  resolver: Resolver,
  setCatalog: StateUpdater<(IgluSchema | ResolvedIgluSchema)[]>
) => {
  const seenRegs = new Map<IgluUri, Registry[]>();
  setCatalog([]);

  resolver.walk().then((discovered) => {
    chunkEach(discovered, (ds, i) => {
      setCatalog((catalog) => ((catalog[i] = ds), [...catalog]));
      if (!seenRegs.has(ds.uri())) seenRegs.set(ds.uri(), []);

      return resolver
        .resolve(ds, seenRegs.get(ds.uri())!)
        .then((res) => {
          setCatalog((catalog) => ((catalog[i] = res), [...catalog]));
        })
        .catch(() => console.log("couldn't find ", ds.uri()));
    });
  });
};

export const Directory: FunctionComponent<DirectoryAttrs> = ({
  search,
  selections,
  resolver,
  setCollapsed,
  children,
  watermark,
}) => {
  const [catalog, setCatalog] = useState<(IgluSchema | ResolvedIgluSchema)[]>(
    [],
  );

  useEffect(
    () => refreshSchemas(resolver, setCatalog),
    [resolver, watermark, resolver.registries]
  );

  const filtered = useMemo(
    () =>
      selections.length || search
        ? catalog.filter((s) => {
            const filterHit =
              !selections.length ||
              (s instanceof ResolvedIgluSchema
                ? !!selections.find((r) => r.id === s.registry.id)
                : false);
            return filterHit && (!search || s.like(search));
          })
        : catalog,
    [selections, search, catalog],
  );

  const directory: SchemaDirectory = useMemo(
    () =>
      sorted(filtered, (s) => s.uri()).reduce((acc, el) => {
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
          {sorted(Object.entries(schemas), (x) => x[0]).map(
            ([name, formats]) => (
              <details class="name" key={name}>
                <summary>{name}</summary>
                {Object.entries(formats).map(([format, versions]) => (
                  <details class="format" key={format} open>
                    <summary>{format}</summary>
                    {sorted(Object.entries(versions), (x) => x[0], true).map(
                      ([version, deployments]) =>
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
                              deployment instanceof ResolvedIgluSchema
                                ? JSON.stringify(deployment.data, null, 4)
                                : deployment.uri(),
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
                              <textarea readOnly rows={val.split("\n").length}>
                                {val}
                              </textarea>
                            </details>
                          )),
                    )}
                  </details>
                ))}
              </details>
            ),
          )}
        </details>
      )),
    [directory],
  );

  return (
    <div class="directory column box">
      {children}
      {listings}
    </div>
  );
};
