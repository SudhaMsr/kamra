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
@pytest.mark.parametrize("stress", [False, True], ids=["normal", "wide-text"])
def test_no_horizontal_scroll_on_phones(mobile: Page, route, stress):
    """Also checks with artificially wide text, since real web fonts can be wider than the fallback font."""
    mobile.set_viewport_size({"width": 360, "height": 800})
    go(mobile, route)
    if stress:
        mobile.add_style_tag(content="*{letter-spacing:.08em!important}")
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{route} scrolls sideways"


@pytest.mark.parametrize("route", ["/search", "/rooms/d001", "/post", "/profile", "/flatmates"])
def test_page_structure_signed_in(page: Page, route):
    create_profile(page)
    go(page, route)
    assert page.evaluate(AUDIT) == []


CONTRAST = """() => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const cx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const mix = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3])).concat(1);
  const bgOf = (el) => { const layers = []; while (el) { const c = rgba(getComputedStyle(el).backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; } el = el.parentElement; }
    let base = layers.length && layers[layers.length - 1][3] >= 0.99 ? layers.pop() : rgba(getComputedStyle(document.body).backgroundColor);
    for (const l of layers.reverse()) base = mix(l, base); return base; };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length || el.closest('[aria-hidden="true"], svg, .sr-only')) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!text) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const bg = bgOf(el); let fg = rgba(cs.color); if (fg[3] < 1) fg = mix(fg, bg);
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) bad.push(`${ratio.toFixed(2)} "${text.slice(0, 30)}"`);
  }
  return [...new Set(bad)];
}"""


@pytest.mark.parametrize("theme", ["light", "dark"])
@pytest.mark.parametrize("route", ["/", "/search", "/rooms/d004", "/flatmates", "/profile", "/post", "/safety"])
def test_all_text_meets_wcag_aa_contrast(page: Page, theme, route):
    """Every visible text node on the page, against its real composited background, in both themes."""
    create_profile(page)
    page.get_by_role("radio", name=f"{theme.capitalize()} theme").first.click()
    go(page, route)
    assert page.evaluate(CONTRAST) == []


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
