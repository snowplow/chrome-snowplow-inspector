import type { Entry } from "har-format";
import type { Dispatch, StateUpdater } from "preact/hooks";
import type { ModalSetter } from "../../Modals";

import importHAR from "./har";
import ngrok from "./ngrok";

export const formats = {
  har: "HAR File",
  bad: "Bad Rows",
  stream: "ElasticSearch",
  ngrok: "Ngrok Tunnel",
} as const;

export type ImporterFormat = keyof typeof formats;

export const importFromFormat = (
  format: ImporterFormat,
  addRequests: (_: Entry[]) => void,
  setModal: ModalSetter,
  {
    ngrokStreaming,
    setNgrokStreaming,
  }: {
    ngrokStreaming: boolean;
    setNgrokStreaming: Dispatch<StateUpdater<boolean>>;
  },
  {
    streamLock,
    setStreamLock,
  }: { streamLock: number; setStreamLock: Dispatch<StateUpdater<number>> },
) => {
  switch (format) {
    case "bad":
      return setModal("badRows", { addRequests });
    case "har":
      return importHAR(addRequests);
    case "ngrok":
      console.log("importing ngrok", ngrokStreaming);
      return ngrok(addRequests, ngrokStreaming, setNgrokStreaming);
    case "stream":
      return setModal("stream", { addRequests, streamLock, setStreamLock });
    default:
      throw new Error(`Unsupported import format: ${format}`);
  }
};
