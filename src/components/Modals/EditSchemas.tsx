import { h, FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

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
  registry: Registry,
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

export const EditSchema: FunctionComponent<{
  registry: Registry;
  schema: string;
  remove: () => void;
}> = ({ registry, remove, schema }) => {
  const [value, setValue] = useState(schema);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [maybeSchema, error] = (() => {
    try {
      if (textRef.current) textRef.current.setCustomValidity("");
      return [validateEdited(value, registry), undefined];
    } catch (e) {
      const err = e instanceof Error ? e.message : "" + e;
      if (textRef.current) textRef.current.setCustomValidity(err);
      return [null, err];
    }
  })();

  return (
    <details class="box">
      <summary>{maybeSchema ? maybeSchema.uri() : "New Schema"}</summary>
      <textarea
        ref={textRef}
        class="textarea"
        onInput={(e) => setValue(e.currentTarget.value)}
        value={value}
      />
      {error && <pre class="error">{error}</pre>}
      <button class="button" type="button" onClick={() => remove()}>
        Remove Schema
      </button>
    </details>
  );
};

export const EditRegistrySchemas: FunctionComponent<{
  registry: Registry;
  existing: (string | undefined)[];
  added: (string | undefined)[];
  addSchema: (schema: string | string[]) => void;
  removeAddedSchema: (index: number) => void;
  removeEditableSchema: (index: number) => void;
}> = ({
  registry,
  existing,
  added,
  addSchema,
  removeAddedSchema,
  removeEditableSchema,
}) => {
  return (
    <fieldset class="box" name={registry.id}>
      <label class="label">{registry.spec.name}</label>
      {existing.map(
        (s, i) =>
          s && (
            <EditSchema
              registry={registry}
              remove={() => removeEditableSchema(i)}
              schema={s}
            />
          ),
      )}
      {added.map(
        (s, i) =>
          s && (
            <EditSchema
              registry={registry}
              remove={() => removeAddedSchema(i)}
              schema={s}
            />
          ),
      )}
      <button
        type="button"
        class="button"
        onClick={() => addSchema(SCHEMA_TEMPLATE)}
      >
        New Schema
      </button>
      <input
        type="file"
        class="button"
        //@ts-ignore: non-standard attribute
        webkitdirectory
        multiple
        onChange={(event) => {
          const target = event.currentTarget;
          if (target.files) {
            Promise.all(
              Array.prototype.map.call(
                target.files,
                (file: File) =>
                  file.size <= 10240 &&
                  file
                    .text()
                    .then((txt) => JSON.parse(txt))
                    .catch(),
              ),
            ).then((maybeSchemas) => {
              const found: string[] = [];
              maybeSchemas.forEach((schema) => {
                if (schema && typeof schema === "object") {
                  if ((schema as { $schema: string }).$schema === $SCHEMA)
                    found.push(JSON.stringify(schema));
                }
              });

              addSchema(found);
            });
          }
        }}
      />
    </fieldset>
  );
};

export const EditSchemas: FunctionComponent<EditSchemasOptions> = ({
  registries,
  setModal,
}) => {
  const [editableSchemas, setEditableSchemas] = useState(() =>
    registries.map(() => [] as (string | undefined)[]),
  );
  const [addedSchemas, setAddedSchemas] = useState(() =>
    registries.map(() => [] as (string | undefined)[]),
  );

  useEffect(() => {
    Promise.all(
      registries.map((reg) =>
        reg.walk().then((schemas) => {
          if (schemas.length) {
            return Promise.all(schemas.map((s) => reg.resolve(s))).then(
              (results) => results.map((r) => JSON.stringify(r.data)),
            );
          } else {
            return Promise.resolve([""]);
          }
        }),
      ),
    ).then(setEditableSchemas);
  }, [registries]);

  return (
    <div class="modal is-active">
      <div class="modal-background" onClick={() => setModal()}></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Edit Local Schemas</p>
          <button class="delete" onClick={() => setModal()}></button>
        </header>
        <section class="modal-card-body">
          <form
            id="edit-schemas"
            class="form schemas-definition"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();

              const form = event.currentTarget;
              if (!form.checkValidity()) {
                form.reportValidity();
                return;
              }

              registries.forEach((registry, i) => {
                if (registry.spec.kind !== "local") return;
                const local = registry as LocalRegistry;

                const edited = Array.prototype.filter
                  .call(form.elements, (el: HTMLElement) => {
                    if (el instanceof HTMLTextAreaElement) {
                      let parent: Node = el;
                      while (
                        parent.parentNode &&
                        parent.nodeName.toUpperCase() !== "FIELDSET"
                      )
                        parent = parent.parentNode;

                      if (parent instanceof HTMLFieldSetElement) {
                        return registry.id === parent.name;
                      }
                    }
                  })
                  .map((el: HTMLTextAreaElement) => el.value);

                const resolved = edited
                  .map((s) => (s ? validateEdited(s, local) : null))
                  .filter((r): r is ResolvedIgluSchema => r !== null);

                local.update(resolved).then(() => setModal());
              });
            }}
          >
            {editableSchemas.map((regSchemas, i) => (
              <EditRegistrySchemas
                registry={registries[i]}
                existing={regSchemas}
                added={addedSchemas[i]}
                removeAddedSchema={(index: number) =>
                  setAddedSchemas((added) => {
                    added[i][index] = undefined;
                    return [...added];
                  })
                }
                removeEditableSchema={(index: number) =>
                  setEditableSchemas((existing) => {
                    existing[i][index] = undefined;
                    return [...existing];
                  })
                }
                addSchema={(schema: string | string[]) =>
                  setAddedSchemas((added) => {
                    const adding = Array.isArray(schema) ? schema : [schema];
                    return added
                      .slice(0, i)
                      .concat([added[i].concat(adding)])
                      .concat(added.slice(i));
                  })
                }
              />
            ))}
          </form>
        </section>
        <footer class="modal-card-foot">
          <button class="button" form="edit-schemas" name="save-schemas">
            Save Schemas
          </button>
        </footer>
      </div>
    </div>
  );
};
