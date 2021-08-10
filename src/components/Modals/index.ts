import { BadRowsModal } from "./BadRowsModal";
import { LiveStreamModal } from "./LiveStreamModal";


export const modals = {
  badRows: BadRowsModal,
  stream: LiveStreamModal,
} as const;

export type Modal = keyof typeof modals;

export interface ModalOptions {
  kind: Modal;
  setModal: (modal?: Modal, opts?: ModalOptions) => void;
}
