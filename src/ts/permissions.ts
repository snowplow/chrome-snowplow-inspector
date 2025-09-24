const pending = new Map<string, Promise<void>>();

const queue: string[] = [];
let nextClick: Promise<void> | undefined;

export const immediatelyRequest = (batch: string[]) => {
  const distinct = batch.filter((e, i, a) => a.indexOf(e) === i);

  return new Promise<void>((fulfil, fail) => {
    try {
      if (!chrome?.runtime?.id) {
        console.warn('Extension context invalidated. Please reload the extension.');
        return fail(new Error('Extension context invalidated'));
      }

      chrome.tabs
        ? chrome.tabs.get(chrome.devtools.inspectedWindow.tabId, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome tabs error:', chrome.runtime.lastError);
              return fail(new Error(chrome.runtime.lastError.message));
            }

            chrome.windows.update(
              tab.windowId,
              {
                drawAttention: true,
                focused: true,
              },
              () => {
                if (chrome.runtime.lastError) {
                  console.error('Chrome windows error:', chrome.runtime.lastError);
                  return fail(new Error(chrome.runtime.lastError.message));
                }

                chrome.permissions.request({ origins: distinct }, (granted) => {
                  if (chrome.runtime.lastError) {
                    console.error('Chrome permissions error:', chrome.runtime.lastError);
                    return fail(new Error(chrome.runtime.lastError.message));
                  }
                  granted ? fulfil() : fail(new Error('Permission denied'));
                });
              },
            );
          })
        : fail(new Error('Chrome tabs API not available'));
    } catch (error) {
      console.error('Extension context error:', error);
      fail(error);
    }
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
    const p = new Promise<void>((fulfil, fail) => {
      try {
        if (!chrome?.runtime?.id) {
          console.warn('Extension context invalidated. Please reload the extension.');
          return fail(new Error('Extension context invalidated'));
        }

        chrome.permissions
          ? chrome.permissions.contains({ origins: missing }, (granted) => {
              if (chrome.runtime.lastError) {
                console.error('Chrome permissions error:', chrome.runtime.lastError);
                return fail(new Error(chrome.runtime.lastError.message));
              }
              if (granted) fulfil();
              else fail(missing);
            })
          : fail(new Error('Chrome permissions API not available'));
      } catch (error) {
        console.error('Extension context error:', error);
        fail(error);
      }
    }).catch(nextGesture);

    missing.forEach((origin) => pending.set(origin, p));
  }

  return Promise.all(
    origins.map((origin) => pending.get(origin) || Promise.reject()),
  ).then();
};
