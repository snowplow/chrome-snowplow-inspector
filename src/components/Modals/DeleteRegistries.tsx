import { h, type FunctionComponent } from "preact";

import type { ModalOptions } from ".";
import { BaseModal } from "./BaseModal";
import { type Registry, Resolver } from "../../ts/iglu";
import { RegistryDetail } from "../SchemaManager/RegistryDetail";

export interface DeleteRegistriesOptions extends ModalOptions {
  registries: Registry[];
  resolver: Resolver;
}

export const DeleteRegistries: FunctionComponent<DeleteRegistriesOptions> = ({
  setModal,
  registries,
  resolver,
}) => (
  <BaseModal title="Delete Schema Registries" onClose={setModal}>
    <section class="modal-card-body">
      <p>
        You are about to remove the following registries from the extension.
        This can not be undone.
      </p>
      <select multiple disabled size={5}>
        {registries.map((reg) => (
          <RegistryDetail registry={reg} />
        ))}
      </select>
    </section>
    <footer class="modal-card-foot">
      <button
        class="button is-danger"
        onClick={() => {
          const toRemove = registries.length;
          const removed = resolver.remove(...registries).length;
          console.assert(toRemove === removed);
          resolver.persist().then(() => setModal());
        }}
      >
        Yes, delete
      </button>
    </footer>
  </BaseModal>
);
