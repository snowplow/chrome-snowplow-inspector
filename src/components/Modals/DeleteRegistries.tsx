import { h, FunctionComponent } from "preact";

import { ModalOptions } from ".";
import { Registry, Resolver } from "../../ts/iglu";
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
  <div class="modal is-active registry-delete">
    <div class="modal-background" onClick={() => setModal()}></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Delete Schema Registries</p>
        <button class="delete" onClick={() => setModal()} />
      </header>
      <section class="modal-card-body">
        <p>
          You are about to remove the following registries from the extension.
          This can not be undone.
        </p>
        <select multiple disabled size={5}>
          {registries.map((reg) => <RegistryDetail registry={reg} />)}
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
    </div>
  </div>
);
