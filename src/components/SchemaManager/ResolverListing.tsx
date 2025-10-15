import { h, type FunctionComponent } from "preact";

import { type Registry, Resolver } from "../../ts/iglu";

import { RegistryDetail } from "./RegistryDetail";

export const ResolverListing: FunctionComponent<{
  resolver: Resolver;
  selected: Registry[];
  selectRegistries: (regs: Registry[]) => void;
}> = ({ resolver, selected, selectRegistries }) => (
  <fieldset
    onChange={({ currentTarget }) => {
      const selections = Object.fromEntries(
        Array.from(currentTarget.getElementsByTagName("input"), (e) => [
          e.value,
          e.checked,
        ]),
      );

      selectRegistries(resolver.registries.filter((r) => selections[r.id]));
    }}
  >
    {resolver.registries.map((reg) => (
      <RegistryDetail
        key={reg.id}
        registry={reg}
        selected={selected.includes(reg)}
      />
    ))}
  </fieldset>
);
