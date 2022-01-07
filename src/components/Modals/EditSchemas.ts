import { default as m, redraw, ClosureComponent } from "mithril";

import { ModalOptions } from ".";
import {
  $SCHEMA,
  IgluSchema,
  IgluUri,
  Registry,
  ResolvedIgluSchema,
} from "../../ts/iglu";
import { LocalRegistry } from "../../ts/iglu/Registries";
import { objHasProperty } from "../../ts/util";

export interface EditSchemasOptions extends ModalOptions {
  registries: Registry[];
}

const SCHEMA_TEMPLATE = `{
    "$schema": "${$SCHEMA}",
    "self": {
        "vendor": null,
        "name": null,
        "format": "jsonschema",
        "version": "1-0-0"
    },
    "description": "",
    "properties": {},
    "type": "object",
    "required": []
}`;

const validateEdited = (
  text: string,
  registry: Registry
): ResolvedIgluSchema | null => {
  const val: unknown = JSON.parse(text);

  if (typeof val !== "object" || !val) throw Error("Schema must be an object");
  if (!objHasProperty(val, "$schema")) throw Error("Missing $schema URI");
  if (val["$schema"] !== $SCHEMA) throw Error("Invalid $schema URI");
  if (!objHasProperty(val, "self"))
    throw Error("Missing self object in Self Descring JSON");
  if (typeof val["self"] !== "object" || !val["self"])
    throw Error("self property must be an object in Self Descring JSON");
  const self = val["self"];
  if (!objHasProperty(self, "vendor") || typeof self["vendor"] !== "string")
    throw Error("Missing vendor in self object");
  if (!objHasProperty(self, "name") || typeof self["name"] !== "string")
    throw Error("Missing name in self object");
  if (!objHasProperty(self, "format") || typeof self["format"] !== "string")
    throw Error("Missing format in self object");
  if (!objHasProperty(self, "version") || typeof self["version"] !== "string")
    throw Error("Missing version in self object");

  const uri: IgluUri = `iglu:${self.vendor}/${self.name}/${self.format}/${self.version}`;
  const igluSchema = IgluSchema.fromUri(uri);
  if (!igluSchema) throw Error("Self object defines invalid Iglu URI");

  return igluSchema.resolve(val, registry);
};

export const EditSchemas: ClosureComponent<EditSchemasOptions> = ({
  attrs: { registries },
}) => {
  const editableSchemas: ((string | undefined)[] | undefined)[] = [];
  const addedSchemas: ((string | undefined)[] | undefined)[] = [];

  return {
    oninit: () => {
      registries.map((reg, i) =>
        reg.walk().then((schemas) => {
          const es = (editableSchemas[i] = editableSchemas[i] || []);
          addedSchemas[i] = addedSchemas[i] || [];
          if (schemas.length) {
            schemas.map((s, j) => {
              reg.resolve(s).then((r) => {
                es[j] = JSON.stringify(r.data);
                redraw();
              });
            });
          } else if (!es.length) {
            es.push("");
            redraw();
          }
        })
      );
    },
    view: ({ attrs: { setModal } }) =>
      m("div.modal.is-active", [
        m("div.modal-background", { onclick: () => setModal() }),
        m("div.modal-card", [
          m("header.modal-card-head", [
            m("p.modal-card-title", "Edit Local Schemas"),
            m("button.delete", {
              onclick: () => setModal(),
            }),
          ]),
          m(
            "section.modal-card-body",
            m(
              "form#edit-schemas.form.schemas-definition",
              {
                onsubmit: (event: Event) => {
                  if (event.target instanceof HTMLFormElement) {
                    event.preventDefault();
                    event.stopPropagation();

                    const form = event.target;
                    if (!form.checkValidity()) {
                      form.reportValidity();
                      return;
                    }

                    registries.forEach((registry, i) => {
                      if (registry.spec.kind !== "local") return;
                      const local = registry as LocalRegistry;

                      const edited = editableSchemas[i] || [];
                      const added = addedSchemas[i] || [];
                      const resolved = edited
                        .concat(added)
                        .map((s) => (s ? validateEdited(s, local) : null))
                        .filter((r): r is ResolvedIgluSchema => r !== null);

                      local.update(resolved).then(() => setModal());
                    });
                  }
                },
              },
              editableSchemas.map((regSchemas, i, editableSchemas) => {
                const editable = (editableSchemas[i] = regSchemas || []);
                const added = (addedSchemas[i] = addedSchemas[i] || []);
                const registry = registries[i];

                if (regSchemas || added)
                  return m(
                    "fieldset.box",
                    { name: registry.id },
                    m("label.label", registry.spec.name),
                    [editable, added].map((arr) =>
                      arr.map((schemadef, j, writeback) => {
                        if (!schemadef) return;
                        let maybeSchema: ResolvedIgluSchema | null = null;
                        let error: string | undefined;
                        try {
                          maybeSchema = validateEdited(schemadef, registry);
                        } catch (e) {
                          if (e instanceof Error) error = e.message;
                          else error = "" + e;
                        }

                        return m(
                          "details.box",
                          m(
                            "summary",
                            maybeSchema ? maybeSchema.uri() : "New Schema"
                          ),
                          m("textarea.textarea", {
                            onupdate: ({ dom }) => {
                              if (dom instanceof HTMLTextAreaElement) {
                                dom.setCustomValidity(error || "");
                              }
                            },
                            oninput: (event: InputEvent) => {
                              if (event.target instanceof HTMLTextAreaElement) {
                                writeback[j] = event.target.value;
                              }
                            },
                            value: maybeSchema
                              ? JSON.stringify(maybeSchema.data, null, 4)
                              : schemadef,
                          }),
                          error && m("pre.error", error),
                          m(
                            "button.button",
                            {
                              onclick: (event: MouseEvent) => {
                                event.preventDefault();
                                writeback[j] = undefined;
                              },
                            },
                            "Remove Schema"
                          )
                        );
                      })
                    ),
                    m(
                      "button.button",
                      {
                        onclick: (event: MouseEvent) => {
                          event.preventDefault();
                          const added = (addedSchemas[i] =
                            addedSchemas[i] || []);
                          added.push(SCHEMA_TEMPLATE);
                        },
                      },
                      "New Schema"
                    )
                  );
              })
            ),
            m(
              "footer.modal-card-foot",
              m(
                "button.button[form=edit-schemas][name=save-schemas]",
                "Save Schemas"
              )
            )
          ),
        ]),
      ]),
  };
};
