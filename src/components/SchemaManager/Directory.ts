import { default as m, redraw, Vnode } from "mithril";
import { IgluSchema, ResolvedIgluSchema, Resolver } from "../../ts/iglu";
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

const catalog: ResolvedIgluSchema[] = [];

export const Directory = {
  oninit: (vnode: Vnode<{ resolver: Resolver }>) => {
    catalog.length = 0;
    const { resolver } = vnode.attrs;
    resolver.walk().then((discovered) =>
      Promise.all(
        discovered.map((s) =>
          vnode.attrs.resolver
            .resolve(s)
            .then((res) => {
              catalog.push(res);
              redraw();
            })
            .catch((reason) => console.log("resolving", s, "failed", reason))
        )
      )
    );
  },
  view: (vnode: Vnode<{ resolver: Resolver }>) => {
    const directory: SchemaDirectory = catalog.reduce((acc, el) => {
      const v = (acc[el.vendor] = acc[el.vendor] || {});
      const n = (v[el.name] = v[el.name] || {});
      const f = (n[el.format] = n[el.format] || {});
      f[el.version] = f[el.version] || [];
      f[el.version].push(el);

      return acc;
    }, {} as SchemaDirectory);

    return m(
      "div.directory.column",
      Object.entries(directory).map(([vendor, schemas]) => {
        return m("details.vendor[open]", [
          m("summary", vendor),
          sorted(Object.entries(schemas), (x) => x[0]).map(([name, formats]) =>
            m("details.name", [
              m("summary", name),
              Object.entries(formats).map(([format, versions]) =>
                m("details.format[open]", [
                  m("summary", format),
                  sorted(Object.entries(versions), (x) => x[0]).map(
                    ([version, deployments]) =>
                      m("details.version", [
                        m("summary", version),
                        m(
                          "ul.registries",
                          deployments.map((d) =>
                            m(
                              "li",
                              m("textarea", {
                                value: JSON.stringify(d.data, null, 4),
                              })
                            )
                          )
                        ),
                      ])
                  ),
                ])
              ),
            ])
          ),
        ]);
      })
    );
  },
};
