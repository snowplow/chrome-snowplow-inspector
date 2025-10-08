import { h, type FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import type { Registry } from "../../ts/iglu";
import type { RegistrySpec } from "../../ts/types";

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
    registry.vendorPrefixes || [],
  );
  const [fieldVals, setFieldVals] = useState<Record<string, string | boolean>>(
    registry.opts,
  );

  return (
    <fieldset name={registry.id}>
      <input
        type="hidden"
        name="id"
        readOnly
        onInput={(event) => setId(event.currentTarget.value)}
        value={id}
      />
      <label title="Name for this registry. Used only in the extension">
        Name
        <input
          type="text"
          name="name"
          required
          pattern=".+"
          onInput={(event) => setName(event.currentTarget.value)}
          value={name}
        />
      </label>
      <label title="The type of Registry this is. Determines which API or request format is used to access schemas">
        Kind
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
      </label>
      {Object.entries(registry.fields).map(
        ([field, { title, type, description, required, pattern }]) => (
          <label key={field}>
            {title}
            <input
              type={type}
              name={field}
              pattern={pattern}
              required={required}
              title={description}
              onInput={(event) =>
                setFieldVals((fv) => ({
                  ...fv,
                  [field]:
                    type === "checkbox"
                      ? !!event.currentTarget.checked
                      : event.currentTarget.value,
                }))
              }
              onChange={(event) => event.currentTarget.reportValidity()}
              value={
                type !== "checkbox"
                  ? ((fieldVals[field] as string | undefined) ?? "")
                  : undefined
              }
              checked={
                type === "checkbox"
                  ? String(fieldVals[field]) === "true"
                  : undefined
              }
            />
          </label>
        ),
      )}
      <label title="Priority, lower is higher. Not used by the extension, which prefers the fastest registry configured">
        Priority
        <input
          type="number"
          name="priority"
          min={0}
          onInput={(event) => setPriority(+event.currentTarget.value)}
          value={priority || 0}
        />
      </label>
      <label title="Vendor prefixes, for preferring registries for particular schema lookups. If this is specified, only schemas with these prefixes will be fetched from teh registry">
        Vendor Prefixes
        <textarea
          name="vendorPrefixes"
          rows={Math.min(5, vendorPrefixes.length || 1)}
          onChange={(event) =>
            setVendorPrefixes(
              event.currentTarget.value.split("\n").filter(Boolean),
            )
          }
          value={vendorPrefixes.join("\n")}
        />
      </label>
      <label title="Current status of the registry">
        Status: <output title={registry.opts.statusReason} />
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
    className="inline-flex items-center rounded-md bg-[#8BD9FE]/10 px-2 py-1 text-sm font-medium text-[#8BD9FE] inset-ring inset-ring-blue-400/30 m-0.5 cursor-pointer"
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
