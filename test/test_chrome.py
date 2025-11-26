from collections.abc import Callable
from contextlib import AbstractContextManager

import pytest

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait


def test_ui_loads(
    selenium: WebDriver,
    wait: WebDriverWait,
    inspector: Callable[[], AbstractContextManager[None]],
) -> None:
    with inspector():
        wait.until(
            lambda _: selenium.find_element(By.CSS_SELECTOR, "label[title='Events']"),
            "Never found events tab",
        )


def test_detects_post(
    selenium: WebDriver,
    wait: WebDriverWait,
    inspector: Callable[[], AbstractContextManager[None]],
    tracker: Callable[[str], None],
) -> None:
    tracker("trackPageView")

    with inspector():
        wait.until(
            lambda _: selenium.find_element(By.CSS_SELECTOR, ".event-group li"),
            "Never found fired pageview in POST requests",
        )


@pytest.mark.tracker_params({"eventMethod": "get"})
def test_detects_get(
    selenium: WebDriver,
    wait: WebDriverWait,
    inspector: Callable[[], AbstractContextManager[None]],
    tracker: Callable[[str], None],
) -> None:
    tracker("trackPageView")

    with inspector():
        wait.until(
            lambda _: selenium.find_element(By.CSS_SELECTOR, ".event-group li"),
            "Never found fired pageview in GET requests",
        )

@pytest.mark.tracker_params({"appId": "tracker1"}, {"appId": "tracker2"})
def test_detects_multiple(
    selenium: WebDriver,
    wait: WebDriverWait,
    inspector: Callable[[], AbstractContextManager[None]],
    tracker: Callable[[str], None],
) -> None:
    tracker("trackPageView")

    with inspector():
        elements = wait.until(
            lambda _: selenium.find_elements(By.CSS_SELECTOR, ".event-group li"),
            "Never found events from any trackers",
        )

        assert len(elements) == 2, "Expected an event for each tracker"
