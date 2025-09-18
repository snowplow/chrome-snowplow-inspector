import type { Entry, Har } from "har-format";

import { isSnowplow } from "../../../ts/util";

export default (cb: (entries: Entry[]) => void) => {
  const f: HTMLInputElement = document.createElement("input");
  f.type = "file";
  f.multiple = true;
  f.accept = ".har";

  f.onchange = (change: Event) => {
    if (change.target instanceof HTMLInputElement) {
      const files = change.target.files || new FileList();

      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);

        if (file !== null) {
          const fr = new FileReader();

          fr.addEventListener(
            "load",
            () => {
              const content = JSON.parse(fr.result as string) as Har;
              cb(
                content.log.entries.filter((entry) =>
                  isSnowplow(entry.request),
                ),
              );
            },
            false,
          );

          fr.readAsText(file);
        }
      }
    }
  };

  f.click();
};
