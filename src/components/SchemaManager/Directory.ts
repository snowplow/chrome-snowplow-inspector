import { default as m, Vnode } from "mithril";
import {
  Registry,
  IgluSchema,
  ResolvedIgluSchema,
  Resolver,
} from "../../ts/iglu";
import { sorted } from "../../ts/util";

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
  [version: string]: IgluSchema[];
}

type DirectoryAttrs = {
  resolver: Resolver;
  search?: RegExp;
  selections: Registry[];
  requestUpdate: (request?: boolean) => boolean;
};

const catalog: (IgluSchema | ResolvedIgluSchema)[] = [];
const refreshSchemas = (resolver: Resolver) => {
  resolver.walk().then((discovered) => {
    catalog.splice(0);
    discovered.map((ds, i) => {
      catalog[i] = ds;
      resolver.resolve(ds).then((res) => {
        catalog[i] = res;
        m.redraw();
      });
    });
  });
};

export const Directory = {
  oninit: ({ attrs: { resolver } }: Vnode<DirectoryAttrs>) => {
    refreshSchemas(resolver);
  },
  view: (vnode: Vnode<DirectoryAttrs>) => {
    const { search, selections, requestUpdate, resolver } = vnode.attrs;
    if (requestUpdate()) {
      requestUpdate(false);
      refreshSchemas(resolver);
    }

    const filtered =
      selections.length || search
        ? catalog.filter((s) => {
            const filterHit =
              !selections.length ||
              (s instanceof ResolvedIgluSchema
                ? selections.includes(s.registry)
                : false);
            const searchHit = !search || s.like(search);
            return filterHit && searchHit;
          })
        : catalog;

    const directory: SchemaDirectory = sorted(filtered, (s) => s.uri()).reduce(
      (acc, el) => {
        const v = (acc[el.vendor] = acc[el.vendor] || {});
        const n = (v[el.name] = v[el.name] || {});
        const f = (n[el.format] = n[el.format] || {});
        f[el.version] = f[el.version] || [];
        f[el.version].push(el);

        return acc;
      },
      {} as SchemaDirectory
    );

    return m(
      "div.directory.column.box",
      vnode.children,
      Object.entries(directory).map(([vendor, schemas]) => {
        return m(
          "details.vendor[open]",
          { key: vendor },
          m("summary", vendor),
          sorted(Object.entries(schemas), (x) => x[0]).map(([name, formats]) =>
            m(
              "details.name",
              m("summary", name),
              Object.entries(formats).map(([format, versions]) =>
                m(
                  "details.format[open]",
                  m("summary", format),
                  sorted(Object.entries(versions), (x) => x[0], true).map(
                    ([version, deployments]) =>
                      m(
                        "details.version",
                        m("summary", version),
                        m(
                          "ul.registries",
                          deployments.map((d) => {
                            const json =
                              d instanceof ResolvedIgluSchema
                                ? JSON.stringify(d.data, null, 4)
                                : d.uri();
                            return m(
                              "li",
                              m(
                                "textarea[readonly]",
                                { rows: json.split("\n").length },
                                json
                              )
                            );
                          })
                        )
                      )
                  )
                )
              )
            )
          )
        );
      })
    );
  },
};
