import { default as m, Vnode } from "mithril";
import { Resolver } from "../../ts/iglu/Resolver";
import { IgluSchema } from "../../ts/types";

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

export const Directory = {
  view: (vnode: Vnode<{ resolver: Resolver }>) => {
    const { resolver } = vnode.attrs;

    const schemas: IgluSchema[] = resolver.walk();

    const directory: SchemaDirectory = schemas.reduce((acc, el) => {
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
        return m("summary.vendor", [
          vendor,
          m(
            "details",
            Object.entries(schemas).map(([name, formats]) =>
              m("summary.name", [
                name,
                m(
                  "details",
                  Object.entries(formats).map(([format, versions]) =>
                    m("summary.format", [
                      format,
                      m(
                        "details",
                        Object.entries(versions).map(([version, deployments]) =>
                          m("summary.version", [
                            version,
                            m(
                              "ul.registries",
                              deployments.map((d) => m("li", d))
                            ),
                            deployments[0].description
                              ? m("p.description", deployments[0].description)
                              : undefined,
                            m("textarea", {
                              value: JSON.stringify(
                                deployments[0].data,
                                null,
                                4
                              ),
                            }),
                          ])
                        )
                      ),
                    ])
                  )
                ),
              ])
            )
          ),
        ]);
      })
    );
  },
};
