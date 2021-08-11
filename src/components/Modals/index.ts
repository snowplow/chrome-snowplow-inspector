import { BadRows } from "./BadRows";
import { LiveStream } from "./LiveStream";

export const modals = {
  badRows: BadRows,
  stream: LiveStream,
} as const;

export type Modal = keyof typeof modals;

export interface ModalOptions {
  kind: Modal;
  setModal: (modal?: Modal, opts?: ModalOptions) => void;
}
