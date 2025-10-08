const pending = new Map<string, Promise<void>>();

chrome.permissions?.getAll(({ origins }) =>
  origins?.forEach((origin) => pending.set(origin, Promise.resolve())),
);

const queue: string[] = [];
let nextClick: Promise<void> | undefined;

export const immediatelyRequest = (batch: string[]) => {
  const distinct = batch.filter((e, i, a) => a.indexOf(e) === i);

  return new Promise<void>((fulfil, fail) => {
    chrome.tabs
      ? chrome.tabs.get(chrome.devtools.inspectedWindow.tabId, (tab) =>
          chrome.windows.update(
            tab.windowId,
            {
              drawAttention: true,
              focused: true,
            },
            () =>
              chrome.permissions.request({ origins: distinct }, (granted) =>
                granted ? fulfil() : fail(),
              ),
          ),
        )
      : fail(distinct);
  });
};

const nextGesture = (missing: string[]) => {
  queue.push(...missing);

  return (nextClick =
    nextClick ||
    new Promise<string[]>((fulfil) => {
      const onNextClick = () => {
        removeEventListener("click", onNextClick);
        nextClick = undefined;
        const batch = queue.splice(0);
        fulfil(batch);
      };

      addEventListener("click", onNextClick, false);
    }).then(immediatelyRequest));
};

export const request = (...origins: string[]): Promise<void> => {
  const missing = origins.filter(
    (origin, i, a) => !pending.has(origin) && a.indexOf(origin) === i,
  );

  if (missing.length) {
    const p = new Promise<void>((fulfil, fail) =>
      chrome.permissions
        ? chrome.permissions.contains({ origins: missing }, (granted) => {
            if (granted) fulfil();
            else fail(missing);
          })
        : fail(missing),
    ).catch(nextGesture);

    missing.forEach((origin) => pending.set(origin, p));
  }

  return Promise.all(
    origins.map((origin) => pending.get(origin) || Promise.reject()),
  ).then();
};
