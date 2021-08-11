import { BadRows } from "./BadRows";
import { ImportRegistries } from "./ImportRegistries";
import { LiveStream } from "./LiveStream";

export const modals = {
  badRows: BadRows,
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
