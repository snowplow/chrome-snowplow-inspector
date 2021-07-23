import { default as m, redraw, Vnode } from "mithril";
import { Registry, ResolvedIgluSchema, Resolver } from "../../ts/iglu";
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
  [version: string]: ResolvedIgluSchema[];
}

type DirectoryAttrs = {
  resolver: Resolver;
  search?: RegExp;
  selections: Registry[];
};

const catalog: ResolvedIgluSchema[] = [];

export const Directory = {
  oninit: (vnode: Vnode<DirectoryAttrs>) => {
    catalog.length = 0;
    const { resolver } = vnode.attrs;
    resolver.walk().then((discovered) =>
      Promise.all(
        discovered.map((s) =>
          vnode.attrs.resolver
            .resolve(s)
            .then((res: ResolvedIgluSchema) => {
              catalog.push(res);
              redraw();
            })
            .catch((reason) => console.log("resolving", s, "failed", reason))
        )
      )
    );
  },
  view: (vnode: Vnode<DirectoryAttrs>) => {
    const { search, selections } = vnode.attrs;
    const filtered =
      selections.length || search
        ? catalog.filter((s) => {
            const filterHit =
              !selections.length || selections.includes(s.registry);
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
      "div.directory.column",
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
                            const json = JSON.stringify(d.data, null, 4);
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
