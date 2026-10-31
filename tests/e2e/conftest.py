"""Shared fixtures: one Chrome per session, a fresh context (empty storage) per test.

KAMRA_URL   site under test (default: local build served by scripts/serve.mjs)
CHROME_PATH optional path to a Chrome binary; otherwise Playwright's bundled Chromium is used
"""
import os
import re

import pytest
from playwright.sync_api import Page, sync_playwright

BASE = os.environ.get("KAMRA_URL", "http://127.0.0.1:4173/").rstrip("/") + "/"
IGNORED = re.compile(r"fonts\.(googleapis|gstatic)\.com|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED")


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        kwargs = {"args": ["--no-sandbox"]}
        if os.environ.get("CHROME_PATH"):
            kwargs["executable_path"] = os.environ["CHROME_PATH"]
        b = p.chromium.launch(**kwargs)
        yield b
        b.close()


class Errors(list):
    def real(self):
        return [e for e in self if not IGNORED.search(e)]


def _page(browser, viewport):
    ctx = browser.new_context(viewport=viewport, locale="en-IN", timezone_id="Asia/Kolkata",
                              permissions=["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    errors = Errors()
    page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url} {r.failure}"))
    page.errors = errors
    page.set_default_timeout(8000)
    return ctx, page


@pytest.fixture
def page(browser) -> Page:
    ctx, pg = _page(browser, {"width": 1366, "height": 900})
    yield pg
    assert pg.errors.real() == [], f"browser errors: {pg.errors.real()}"
    ctx.close()


@pytest.fixture
def mobile(browser) -> Page:
    ctx, pg = _page(browser, {"width": 390, "height": 844})
    yield pg
    assert pg.errors.real() == [], f"browser errors: {pg.errors.real()}"
    ctx.close()


def go(page: Page, route: str = ""):
    page.goto(BASE + ("#" + route if route else ""))
    page.locator("#main h1").first.wait_for()


def settle(page: Page):
    """Waits until every finite CSS animation and transition has finished (infinite ones, like spinners, are ignored)."""
    page.wait_for_function("""() => document.getAnimations().every(a => {
        const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        return a.playState !== 'running' || (t && t.iterations === Infinity);
    })""", timeout=5000)


_seq = {"n": 0}


def create_profile(page: Page, *, name="Ananya Rao", gender="Woman", diet="Pure veg", budget="16000", city="Bengaluru",
                   role="Both", email=None, password="Kamra2026!", expect_url=r"#/(search|post|my-rooms)"):
    """Signs up through the real multi-step flow and lands on the welcome screen's first action."""
    _seq["n"] += 1
    email = email or f"user{_seq['n']}-{id(page) % 100000}@example.com"
    go(page, "/signup")
    page.get_by_role("radio", name=re.compile(role)).first.click()
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Your name").fill(name)
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Age").fill("26")
    page.get_by_label("What you do").fill("Software engineer")
    page.get_by_role("radiogroup", name="Gender").get_by_role("radio", name=gender, exact=True).click()
    page.get_by_label("City").select_option(city)
    page.get_by_role("button", name="Continue").click()
    page.get_by_role("radiogroup", name="What you eat").get_by_role("radio", name=diet).click()
    page.get_by_role("button", name="Continue").click()
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Monthly rent budget (₹)").fill(budget)
    page.get_by_role("button", name="Create account").click()
    page.get_by_role("heading", name=re.compile("Welcome to Kamra")).wait_for(timeout=15000)
    page.locator("#main a.btn-primary").first.click()
    page.wait_for_url(re.compile(expect_url))
    return email


def pytest_runtest_logreport(report):
    """On GitHub Actions, surface each failure as an annotation so it shows on the run page."""
    if os.environ.get("GITHUB_ACTIONS") and report.failed:
        msg = str(report.longrepr).strip().splitlines()
        lines = [line.strip() for line in msg if line.strip().startswith("E ")][:6] or msg[-3:]
        text = " | ".join(lines)
        print(f"\n::error title={report.nodeid}::{text[:900].replace(chr(10), ' ')}")
