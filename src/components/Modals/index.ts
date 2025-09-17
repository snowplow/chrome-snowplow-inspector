import { BadRows } from "./BadRows";
import { ChangeDestination } from "./ChangeDestination";
import { DeleteRegistries } from "./DeleteRegistries";
import { EditRegistries } from "./EditRegistries";
import { EditSchemas } from "./EditSchemas";
import { EditTestSuites } from "./EditTestSuites";
import { ImportRegistries } from "./ImportRegistries";
import { LiveStream } from "./LiveStream";

import "./Modals.css";

export const modals = {
  badRows: BadRows,
  deleteRegistries: DeleteRegistries,
  destination: ChangeDestination,
  editRegistries: EditRegistries,
  editSchemas: EditSchemas,
  editTestSuites: EditTestSuites,
  importRegistries: ImportRegistries,
  stream: LiveStream,
} as const;

export type Modal = keyof typeof modals;

export interface ModalOptions {
  setModal: (modal?: Modal, opts?: ModalOptions) => void;
  callback?: () => void;
  [opt: string]: any;
}

export type ModalSetter = (
  modal?: Modal,
  opts?: Omit<ModalOptions, "setModal">,
) => void;
