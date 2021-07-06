import { default as m, redraw, Vnode } from "mithril";
import { IgluSchema, Resolver } from "../../ts/iglu";

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

const catalog: IgluSchema[] = [];

export const Directory = {
  oninit: (vnode: Vnode<{ resolver: Resolver }>) => {
    const { resolver } = vnode.attrs;
    resolver
      .walk()
      .then(
        (discovered) => (
          (catalog.length = 0), catalog.push.apply(catalog, discovered)
        )
      )
      .then(redraw);
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
        return m("details.vendor", [
          m("summary", vendor),
          Object.entries(schemas).map(([name, formats]) =>
            m("details.name", [
              m("summary", name),
              Object.entries(formats).map(([format, versions]) =>
                m("details.format[open]", [
                  m("summary", format),
                  Object.entries(versions).map(([version, deployments]) =>
                    m("details.version", [
                      m("summary", version),
                      m(
                        "ul.registries",
                        deployments.map((d) =>
                          m(
                            "li",
                            m("textarea", { value: JSON.stringify(d, null, 4) })
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
