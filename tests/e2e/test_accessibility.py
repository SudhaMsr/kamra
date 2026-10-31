"""Structural accessibility checks on every page: one h1, labelled controls, alt text, unique ids, keyboard access."""
import pytest
from playwright.sync_api import Page, expect

from conftest import create_profile, go

ROUTES = ["/", "/search", "/rooms/d001", "/flatmates", "/post", "/messages", "/saved", "/profile", "/safety", "/visits", "/my-rooms"]

AUDIT = """() => {
  const problems = [];
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const main = document.querySelector('#main');
  const h1s = [...main.querySelectorAll('h1')].filter(visible);
  if (h1s.length !== 1) problems.push(`expected 1 visible h1 in main, found ${h1s.length}`);
  const ids = {};
  document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
  Object.entries(ids).filter(([, n]) => n > 1).forEach(([id]) => problems.push(`duplicate id #${id}`));
  document.querySelectorAll('img').forEach((img) => { if (!img.hasAttribute('alt')) problems.push(`img without alt: ${img.src.slice(0, 40)}`); });
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((el) => {
    if (!visible(el) && !el.classList.contains('sr-only')) return;
    const named = el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (!named) problems.push(`unlabelled ${el.tagName.toLowerCase()}#${el.id || '?'}`);
  });
  document.querySelectorAll('button, a[href]').forEach((el) => {
    if (!visible(el)) return;
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
    if (!name) problems.push(`nameless ${el.tagName.toLowerCase()} ${el.outerHTML.slice(0, 80)}`);
  });
  document.querySelectorAll('[aria-describedby]').forEach((el) => {
    el.getAttribute('aria-describedby').split(/\\s+/).forEach((id) => { if (!document.getElementById(id)) problems.push(`aria-describedby → missing #${id}`); });
  });
  if (!document.documentElement.lang) problems.push('missing html lang');
  return problems;
}"""


@pytest.mark.parametrize("route", ROUTES)
def test_page_structure_anonymous(page: Page, route):
    go(page, route)
    assert page.evaluate(AUDIT) == []
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "horizontal overflow"


@pytest.mark.parametrize("route", ROUTES)
def test_no_horizontal_scroll_on_phones(mobile: Page, route):
    go(mobile, route)
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{route} scrolls sideways"


@pytest.mark.parametrize("route", ["/search", "/rooms/d001", "/post", "/profile", "/flatmates"])
def test_page_structure_signed_in(page: Page, route):
    create_profile(page)
    go(page, route)
    assert page.evaluate(AUDIT) == []


@pytest.mark.parametrize("theme", ["light", "dark"])
def test_text_contrast_meets_aa(page: Page, theme):
    """Computes WCAG contrast for body text, muted text and primary buttons against their real backgrounds."""
    go(page)
    page.get_by_role("radio", name=f"{theme.capitalize()} theme").first.click()
    go(page, "/search")
    ratios = page.evaluate("""() => {
      const lum = (c) => { const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
      const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !c.endsWith(', 0)') && c !== 'transparent') return c; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
      const ratio = (el) => { const a = lum(getComputedStyle(el).color), b = lum(bg(el)); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
      const pick = (sel) => { const el = document.querySelector(sel); return el ? ratio(el) : null; };
      return { body: pick('#main h1'), muted: pick('#main p.text-muted'), primary: pick('.btn-primary'), tag: pick('.tag-ok') };
    }""")
    for k, v in ratios.items():
        assert v is None or v >= 4.5, f"{theme} {k} contrast {v:.2f} < 4.5"


def test_keyboard_skip_link_and_radio_arrows(page: Page):
    go(page, "/search")
    page.keyboard.press("Tab")
    skip = page.get_by_role("link", name="Skip to content")
    expect(skip).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.locator("#main")).to_be_focused()
    group = page.get_by_role("complementary", name="Filters").get_by_role("radiogroup", name="Kitchen")
    group.get_by_role("radio", name="Any").focus()
    page.keyboard.press("ArrowRight")
    expect(group.get_by_role("radio", name="Pure veg")).to_be_focused()
    expect(page).to_have_url(__import__("re").compile("diet=pure-veg"))


def test_dialog_traps_focus_and_escape_closes(page: Page):
    go(page, "/rooms/d002")
    page.get_by_role("button", name="Report this listing").click()
    dlg = page.get_by_role("dialog", name="Report this listing")
    expect(dlg).to_be_visible()
    for _ in range(12):
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement.closest('dialog') !== null")
    page.keyboard.press("Escape")
    expect(dlg).to_be_hidden()


def test_map_pins_are_keyboard_reachable_and_announce_coordinates(page: Page):
    go(page, "/search?city=Bengaluru&near=blr-ecospace")
    side = page.get_by_role("complementary", name="Map")
    pins = side.get_by_role("list", name="Rooms on the map").get_by_role("button")
    assert pins.count() > 0
    pins.first.focus()
    expect(side.locator("figcaption")).to_contain_text("° N")
    expect(side.locator("figcaption")).to_contain_text("away")
