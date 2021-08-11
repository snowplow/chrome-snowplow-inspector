import { BadRows } from "./BadRows";
import { DeleteRegistries } from "./DeleteRegistries";
import { ImportRegistries } from "./ImportRegistries";
import { LiveStream } from "./LiveStream";

export const modals = {
  badRows: BadRows,
  deleteRegistries: DeleteRegistries,
  importRegistries: ImportRegistries,
  stream: LiveStream,
} as const;

export type Modal = keyof typeof modals;

export interface ModalOptions {
  setModal: (modal?: Modal, opts?: ModalOptions) => void;
  [opt: string]: any;
}

export type ModalSetter = (
  modal?: Modal,
  opts?: Omit<ModalOptions, "setModal">
) => void;
