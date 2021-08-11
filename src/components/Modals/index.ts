import { LiveStreamModal } from "./LiveStreamModal";
import { BadRows } from "./BadRows";

export const modals = {
  stream: LiveStreamModal,
  badRows: BadRows,
} as const;

export type Modal = keyof typeof modals;

export interface ModalOptions {
  kind: Modal;
  setModal: (modal?: Modal, opts?: ModalOptions) => void;
}
