"""Motion: search loading states, map/list linking, list reordering, and reduced-motion behaviour."""
import re

from playwright.sync_api import Page, expect

from conftest import BASE, create_profile, go, wait_idle


def test_new_search_shows_radar_and_placeholders_then_results(page: Page):
    page.goto(BASE + "#/search?city=Bengaluru&near=blr-ecospace")
    section = page.locator("section[aria-labelledby=results-h]")
    expect(section).to_have_attribute("aria-busy", "true")
    expect(page.get_by_test_id("placeholders")).to_be_visible()
    expect(page.get_by_role("complementary", name="Map").get_by_test_id("radar")).to_be_visible()
    expect(page.get_by_text(re.compile(r"Searching within 5 km"))).to_be_visible()
    wait_idle(page)
    expect(section).to_have_attribute("aria-busy", "false")
    expect(page.get_by_test_id("placeholders")).to_have_count(0)
    expect(page.get_by_role("complementary", name="Map").get_by_test_id("radar")).to_have_count(0)
    expect(page.get_by_text(re.compile(r"^\d+ rooms? within 5 km"))).to_be_visible()


def test_changing_place_reruns_search_but_filters_do_not(page: Page):
    go(page, "/search?city=Bengaluru&near=blr-itpl")
    page.get_by_label("Within").select_option("10")
    expect(page.locator("section[aria-busy=true]")).to_have_count(1)
    wait_idle(page)
    # A filter refines instantly: no loading state.
    page.get_by_role("complementary", name="Filters").get_by_role("button", name="Private room").click()
    expect(page.locator("[data-testid=placeholders]")).to_have_count(0)
    expect(page).to_have_url(re.compile(r"room=private"))


def test_pins_drop_in_nearest_first(page: Page):
    go(page, "/search?city=Hyderabad&near=hyd-hitec&radius=10")
    pins = page.get_by_role("complementary", name="Map").get_by_role("list", name="Rooms on the map").get_by_role("button")
    assert pins.count() > 2
    order = page.evaluate("""() => [...document.querySelectorAll('aside[aria-label=Map] [data-pin]')]
        .map(b => ({ i: +getComputedStyle(b).getPropertyValue('--i'), label: b.getAttribute('aria-label') }))""")
    dist = []
    for o in order:
        m = re.search(r"([\d.]+) (k?m) away", o["label"])
        dist.append((o["i"], float(m.group(1)) * (1000 if m.group(2) == "km" else 1)))
    by_rank = [d for _, d in sorted(dist)]
    assert by_rank == sorted(by_rank), "pins should drop in order of distance"


def test_hovering_a_card_highlights_its_pin_and_vice_versa(page: Page):
    go(page, "/search?city=Bengaluru&near=blr-ecospace")
    card = page.locator("article").nth(1)
    title = card.locator("h3").inner_text()
    card.hover()
    pin = page.locator("aside[aria-label=Map] [data-pin].bg-marigold")
    expect(pin).to_have_count(1)
    expect(pin).to_have_attribute("aria-label", re.compile(re.escape(title)))
    expect(page.locator("aside[aria-label=Map] figcaption")).to_contain_text("away")
    page.mouse.move(5, 5)
    other = page.locator("aside[aria-label=Map] [data-pin]").first
    other.hover()
    expect(page.locator("article.ring-2")).to_have_count(1)


def test_sorting_keeps_every_card_and_reorders(page: Page):
    go(page, "/search?city=Mumbai&near=mum-bkc&radius=25")
    before = sorted(page.locator("article h3").all_inner_texts())
    page.get_by_label("Sort by").select_option("rent-desc")
    expect(page).to_have_url(re.compile(r"sort=rent-desc"))
    after = page.locator("article h3").all_inner_texts()
    assert sorted(after) == before
    rents = [int(re.sub(r"\D", "", t)) for t in page.locator("article .font-mono.text-lg").all_inner_texts()]
    assert rents == sorted(rents, reverse=True)


def test_fit_score_counts_up_to_the_real_value(page: Page):
    create_profile(page)
    go(page, "/rooms/d004")
    badge = page.get_by_text(re.compile(r"^\d+% fit$")).first
    expect(badge).to_be_visible()
    sr = page.get_by_text(re.compile(r"\d+% lifestyle match")).first.inner_text()
    target = re.search(r"(\d+)%", sr).group(1)
    expect(badge).to_have_text(f"{target}% fit", timeout=3000)


def test_reduced_motion_skips_the_loading_delay(browser):
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(BASE + "#/search?city=Pune&near=pun-hinjewadi")
    expect(page.get_by_role("list", name="Search results")).to_be_visible(timeout=1500)
    durations = page.evaluate("[...document.querySelectorAll('.anim-rise')].slice(0,3).map(e => getComputedStyle(e).animationDuration)")
    assert all(d in ("1e-06s", "0.001ms", "0s") or d.endswith("e-06s") for d in durations), durations
    ctx.close()


# ---------- batch 3: forms and feedback ----------

def test_typing_indicator_shows_before_the_reply(page: Page):
    create_profile(page)
    go(page, "/rooms/d001")
    page.get_by_role("button", name=re.compile("^Message")).click()
    page.get_by_role("dialog").get_by_role("button", name="Send message").click()
    log = page.get_by_role("list", name="Messages")
    typing = log.get_by_role("listitem", name=re.compile("is typing"))
    expect(typing).to_be_visible()
    expect(log).to_contain_text("still available", timeout=5000)
    expect(typing).to_have_count(0)


def test_post_room_errors_focus_first_bad_field_and_steps_slide(page: Page):
    create_profile(page, city="Pune")
    go(page, "/post")
    page.get_by_label("Rent per month (₹)").fill("12000")
    page.get_by_role("button", name="Continue").click()
    # Headline is the first field on screen with a problem, so it gets focus.
    expect(page.get_by_label("Headline")).to_be_focused()
    expect(page.locator("#title-err")).to_be_visible()
    steps = page.get_by_role("navigation", name="Steps")
    expect(steps.locator("[aria-current=step]")).to_contain_text("The room")


def test_visit_dialog_errors_keep_focus_on_the_date(page: Page):
    create_profile(page)
    go(page, "/rooms/d004")
    page.get_by_role("button", name="Book a visit").click()
    dlg = page.get_by_role("dialog")
    dlg.get_by_label("Date and time").fill("2020-01-01T10:00")
    dlg.get_by_role("button", name="Request visit").click()
    expect(dlg.locator("#slot-err")).to_be_visible()
    expect(dlg.get_by_label("Date and time")).to_be_focused()


def test_toasts_leave_on_their_own(page: Page):
    go(page, "/search?city=Pune&near=pun-hinjewadi")
    wait_idle(page)
    page.locator("article").first.get_by_role("button", name=re.compile("^Save")).click()
    toast = page.get_by_role("status").filter(has_text="Saved.")
    expect(toast).to_be_visible()
    expect(toast).to_have_count(0, timeout=6000)


def test_feedback_works_with_reduced_motion(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    create_profile(page)
    go(page, "/rooms/d003")
    page.get_by_role("button", name="Book a visit").click()
    page.get_by_role("dialog").get_by_label("Date and time").fill("2031-06-12T18:30")
    page.get_by_role("dialog").get_by_role("button", name="Request visit").click()
    expect(page.get_by_role("dialog", name="Visit requested")).to_be_visible()
    ctx.close()
