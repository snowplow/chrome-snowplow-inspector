chrome.devtools.panels.create(
  "Snowplow",
  "icon-16.png",
  "panel.html",
  (panel) => {
    panel.onShown.addListener(({document}) => {
      document.documentElement.className = "theme" + chrome.devtools.panels.themeName;
    })
  }
);
