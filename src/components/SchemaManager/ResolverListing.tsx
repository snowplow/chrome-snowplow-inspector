import { h, type FunctionComponent } from "preact";

import { type Registry, Resolver } from "../../ts/iglu";

import { RegistryDetail } from "./RegistryDetail";

export const ResolverListing: FunctionComponent<{
  resolver: Resolver;
  selected: Registry[];
  selectRegistries: (regs: Registry[]) => void;
}> = ({ resolver, selected, selectRegistries }) => (
  <select
    multiple
    size={resolver.registries.length}
    onChange={(event) => {
      const target = event.currentTarget;
      const options = Array.from(target.selectedOptions);

      const registries = options
        .map((opt) => resolver.registries.findIndex((r) => r.id === opt.value))
        .filter((i) => i !== -1)
        .map((i) => resolver.registries[i]);
      selectRegistries(registries);
    }}
  >
    {resolver.registries.map((reg) => (
      <RegistryDetail registry={reg} selected={selected.includes(reg)} />
    ))}
  </select>
);
