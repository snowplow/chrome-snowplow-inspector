import { h, FunctionComponent } from "preact";
import { useRef } from "preact/hooks";

import { Registry, Resolver } from "../../ts/iglu";

import { RegistryDetail } from "./RegistryDetail";

export const ResolverListing: FunctionComponent<{
  resolver: Resolver;
  selectRegistries: (regs: Registry[]) => void;
}> = ({ resolver, selectRegistries }) => {
  const selRef = useRef<HTMLSelectElement>(null);

  if (selRef.current) {
    selRef.current.selectedIndex = -1;
  }

  return (
    <select
      ref={selRef}
      multiple
      size={resolver.registries.length}
      onChange={(event) => {
        const target = event.currentTarget;
        const options = Array.from(target.selectedOptions);
        const registries = options
          .map((opt) =>
            resolver.registries.findIndex((r) => r.id === opt.value)
          )
          .filter((i) => i !== -1)
          .map((i) => resolver.registries[i]);
        selectRegistries(registries);
      }}
    >
      {resolver.registries.map((reg) => (
        <RegistryDetail registry={reg} />
      ))}
    </select>
  );
};
