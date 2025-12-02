from collections.abc import Callable, Generator
from contextlib import contextmanager, AbstractContextManager
from http import HTTPStatus
from http.server import HTTPServer, BaseHTTPRequestHandler, SimpleHTTPRequestHandler
from os import environ
from pathlib import Path
from threading import Thread
from typing import Any
from urllib.request import urlopen

import pytest

from selenium.webdriver import ChromeOptions
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

COLLECTOR_PORT = int(environ.get("COLLECTOR_PORT", "9090"))
CONTENT_PORT = int(environ.get("CONTENT_PORT", "9091"))
EXTENSION_MANIFEST = Path(__file__).parent.parent / "dist" / "manifest.json"
JS_TRACKER_URL = environ.get(
    "JS_TRACKER_URL",
    "https://cdn.jsdelivr.net/npm/@snowplow/javascript-tracker@4/dist/sp.js",
)
SELENIUM_WAIT_TIMEOUT_SECONDS = 3


@pytest.fixture
def chrome_options(chrome_options: ChromeOptions) -> ChromeOptions:
    """Set up chromium to load with the extension installed and immediately load devtools."""
    assert (
        EXTENSION_MANIFEST.is_file()
    ), f"Couldn't find extension manifest at {EXTENSION_MANIFEST.absolute()}, have you built the extension?"

    chrome_options.add_argument(
        f"--load-extension={EXTENSION_MANIFEST.parent.absolute()}"
    )
    chrome_options.add_argument("--auto-open-devtools-for-tabs")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_experimental_option("windowTypes", ["other"])
    chrome_options.add_experimental_option("w3c", True)

    return chrome_options


@pytest.fixture(scope="session", autouse=True)
def collector_endpoint() -> Generator[str]:
    """Set up a collector server to send events to, and return the endpoint for passing to trackers."""

    class CollectorHandler(BaseHTTPRequestHandler):
        """A minimal, pretend collector. We don't really care about the response but need to accept requests and pass CORS for them to show up in the Network tab."""

        def do_OPTIONS(self):
            self.send_response(HTTPStatus.OK)
            # CORS
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header(
                "Access-Control-Allow-Headers",
                self.headers["Access-Control-Request-Headers"],
            )
            self.end_headers()
            self.wfile.write(b"")

        def do_GET(self):
            self.do_POST()

        def do_POST(self):
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", "2")

            # CORS
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.end_headers()
            self.wfile.write(b"ok")

    s = HTTPServer(("", COLLECTOR_PORT), CollectorHandler)
    Thread(target=s.serve_forever, daemon=True).start()
    yield f"http://localhost:{COLLECTOR_PORT}"
    s.server_close()


@pytest.fixture(scope="session")
def sdk_content() -> str:
    """Obtain JavaScript tracker SDK contents from a CDN for use on test pages."""
    with urlopen(JS_TRACKER_URL) as req:
        return req.read().decode("utf8")


@pytest.fixture
def test_page(tmp_path: Path, sdk_content: str) -> Generator[str]:
    """Arrange for a test page to be accessible with the tracker SDK available."""
    (tmp_path / "sp.js").write_text(sdk_content)

    class TempDirRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs, directory=tmp_path)

    s = HTTPServer(("", CONTENT_PORT), TempDirRequestHandler)
    Thread(target=s.serve_forever, daemon=True).start()
    yield f"http://localhost:{CONTENT_PORT}/"
    s.server_close()


@pytest.fixture
def install_sdk(selenium: WebDriver, test_page: str) -> None:
    """Install the JS SDK on the current test page with the name "snowplow". Expects sp.js to be available relative to current page."""
    selenium.get(test_page)

    snippet = """
    ;(function(p,l,o,w,i,n,g){
        if(!p[i]){
            p.GlobalSnowplowNamespace=p.GlobalSnowplowNamespace||[];
            p.GlobalSnowplowNamespace.push(i);
            p[i]=function(){(p[i].q=p[i].q||[]).push(arguments)};
            p[i].q=p[i].q||[];
            n=l.createElement(o);
            g=l.getElementsByTagName(o)[0];
            n.async=1;
            n.src=w;
            g.parentNode.insertBefore(n,g)
        }
    }(window,document,"script","sp.js","snowplow"));
    """

    selenium.execute_script(
        """
    document.body.appendChild(
        Object.assign(
            document.createElement("script"),
            {
                innerText: arguments[0],
                type: "text/javascript",
            },
        )
    );
    """,
        snippet,
    )


@pytest.fixture
def window_ids(selenium: WebDriver) -> tuple[str, str]:
    """Of the current open windows, find which is the content window and the DevTools window."""
    browser = None
    devtools = None

    for win in selenium.window_handles:
        selenium.switch_to.window(win)

        if selenium.title == "DevTools":
            devtools = win
        else:
            browser = win

        if browser is not None and devtools is not None:
            break
    else:
        raise RuntimeError("Unable to access DevTools pane")

    return browser, devtools


@pytest.fixture
def wait(selenium: WebDriver) -> WebDriverWait[WebDriver]:
    """Build a waiter for synchronously waiting for things to happen in the browser."""
    return WebDriverWait(selenium, SELENIUM_WAIT_TIMEOUT_SECONDS)


@pytest.fixture
def inspector(
    selenium: WebDriver, window_ids: tuple[str, str], wait: WebDriverWait
) -> Callable[[], AbstractContextManager[None]]:
    """Return a context manager that switches to the Inspector extension's devtools panel, reverting to the main content context upon exit."""
    browser, devtools = window_ids

    def open_inspector():
        selenium.switch_to.window(devtools)
        body = wait.until(
            lambda _: selenium.find_element(By.CSS_SELECTOR, "body"),
            "Couldn't find body in DevTools",
        )

        # if we're docked on the side, the Inspector tab is probably hidden in a menu that's not in the DOM yet
        # force docking to the bottom so viewport is wider and it can become visible
        if "bottom" not in (body.get_attribute("class") or ""):
            body.send_keys(Keys.CONTROL, Keys.SHIFT, "d")

        main = wait.until(
            lambda _: body.find_element(By.CSS_SELECTOR, ".main-tabbed-pane"),
            "Couldn't access main panel of DevTools",
        )

        wait.until(
            lambda _: main.shadow_root.find_element(
                By.CSS_SELECTOR, '[aria-label="Snowplow"]'
            ),
            "Unable to find Inspector tab",
        ).click()

        selenium.switch_to.frame(
            wait.until(
                lambda _: main.find_elements(By.TAG_NAME, "iframe").pop(),
                "Couldn't find Inspector content",
            )
        )

    @contextmanager
    def with_inspector() -> Generator[None]:
        open_inspector()
        try:
            yield
        finally:
            selenium.switch_to.window(browser)

    return with_inspector


@pytest.fixture
def tracker(
    selenium: WebDriver,
    collector_endpoint: str,
    request: pytest.FixtureRequest,
    install_sdk: None,  # side-effects
) -> Callable[..., None]:
    """Create trackers on the page (instantiated with the `tracker_params` mark values), and return a function that will forward arguments to the tracker for easier usage."""
    params_marker = request.node.get_closest_marker("tracker_params")
    tracker_params = params_marker.args if params_marker else [{}]

    for i, params in enumerate(tracker_params, 1):
        selenium.execute_script(
            """ snowplow("newTracker", arguments[0], arguments[1], arguments[2]) """,
            params.get("namespace", f"sp{i}"),
            collector_endpoint,
            params,
        )

    def track(command: str, *args: Any):
        selenium.execute_script("snowplow.apply(null, arguments)", command, *args)

    return track
