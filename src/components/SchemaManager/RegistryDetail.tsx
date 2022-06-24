import { h, FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { Registry } from "../../ts/iglu";
import { RegistrySpec } from "../../ts/types";

const kindFieldOptions: { [name: string]: RegistrySpec["kind"] } = {
  Local: "local",
  "Data Structures API": "ds",
  "Static HTTP": "static",
  "Iglu Server/Mini API": "iglu",
};

const EditableRegistry: FunctionComponent<{
  registry: Registry;
  schemaCount?: number;
}> = ({ registry, schemaCount }) => {
  const [id, setId] = useState(registry.id);
  const [name, setName] = useState(registry.spec.name);
  const [kind, setKind] = useState(registry.spec.kind);
  const [priority, setPriority] = useState(registry.priority || 0);
  const [vendorPrefixes, setVendorPrefixes] = useState(
    registry.vendorPrefixes || []
  );
  const [fieldVals, setFieldVals] = useState<Record<string, string>>(
    registry.opts
  );

  return (
    <fieldset class="box" name={registry.id}>
      <input
        class="input"
        type="hidden"
        name="id"
        readOnly
        onInput={(event) => setId(event.currentTarget.value)}
        value={id}
      />
      <label
        class="label"
        title="Name for this registry. Used only in the extension"
      >
        Name
        <input
          type="text"
          name="name"
          class="input"
          required
          pattern=".+"
          onInput={(event) => setName(event.currentTarget.value)}
          value={name}
        />
      </label>
      <label class="label">Kind</label>
      <div
        class="select"
        title="The type of Registry this is. Determines which API or request format is used to access schemas"
      >
        <select
          name="kind"
          onChange={(event) =>
            setKind(event.currentTarget.value as RegistrySpec["kind"])
          }
          value={kind}
        >
          {Object.entries(kindFieldOptions).map(([name, kindToken]) => (
            <option value={kindToken} selected={kindToken == kind}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {Object.entries(registry.fields).map(
        ([field, { title, type, description, required, pattern }]) => (
          <label class="label">
            {title}
            <input
              type={type}
              name={field}
              pattern={pattern}
              required={required}
              title={description}
              onInput={(event) =>
                setFieldVals((fv) => ({
                  [field]: event.currentTarget.value,
                  ...fv,
                }))
              }
              value={fieldVals[field] || ""}
            />
          </label>
        )
      )}
      <label
        class="label"
        title="Priority, lower is higher. Not used by the extension, which prefers the fastest registry configured"
      >
        Priority
        <input
          type="number"
          name="priority"
          min={0}
          class="input"
          onInput={(event) => setPriority(+event.currentTarget.value)}
          value={priority || 0}
        />
      </label>
      <label
        class="label"
        title="Vendor prefixes, for preferring registries for particular schema lookups. If this is specified, only schemas with these prefixes will be fetched from teh registry"
      >
        Vendor Prefixes
        <textarea
          name="vendorPrefixes"
          class="textarea"
          size={Math.min(5, vendorPrefixes.length || 1)}
          onChange={(event) =>
            setVendorPrefixes(
              event.currentTarget.value.split("\n").filter(Boolean)
            )
          }
          value={vendorPrefixes.join("\n")}
        />
      </label>
      <label
        class="label"
        title="Current status of the registry"
        for="registry-status"
      >
        Status
        <output title={registry.opts.statusReason} />
        {`${registry.lastStatus || "UNCERTAIN"} (${schemaCount || 0} schemas)`}
      </label>
    </fieldset>
  );
};

const RegistryListing: FunctionComponent<{
  registry: Registry;
  selected?: boolean;
}> = ({ registry, selected }) => (
  <option
    class={[
      "registry",
      registry.spec.kind,
      (registry.lastStatus || "").toLowerCase(),
    ].join(" ")}
    value={registry.id}
    selected={!!selected}
  >
    {registry.spec.name}
  </option>
);

export const RegistryDetail: FunctionComponent<{
  registry: Registry;
  editing?: boolean;
  selected?: boolean;
  schemaCount?: number;
}> = ({ editing, registry, schemaCount, selected }) =>
  editing ? (
    <EditableRegistry registry={registry} schemaCount={schemaCount} />
  ) : (
    <RegistryListing registry={registry} selected={selected} />
  );
