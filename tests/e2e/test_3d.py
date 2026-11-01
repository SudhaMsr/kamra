"""3D and motion graphics: the hero dollhouse, How it works scenes, card tilt, flip cards and performance."""
import re

from playwright.sync_api import Page, expect

from conftest import BASE, create_profile, go, settle, wait_idle


def hero(page: Page):
    return page.get_by_test_id("dollhouse")


def test_dollhouse_is_really_3d_and_decorative(page: Page):
    go(page)
    root = hero(page)
    expect(root).to_be_visible()
    expect(root).to_have_attribute("aria-hidden", "true")
    settle(page)
    # Walls are faces rotated 90° to stand up. If anything flattened the 3D, they'd collapse to a sliver.
    heights = page.evaluate("""() => [...document.querySelectorAll('.dh-face')]
        .filter(f => f.style.transform.includes('rotateX(90deg)'))
        .map(f => f.getBoundingClientRect().height)""")
    assert heights and max(heights) > 25, heights
    # Billboards face the camera: the price tag is wider than tall, not squashed into the floor.
    tag = root.get_by_text("₹16,500")
    box = tag.bounding_box()
    assert box["width"] > 40 and box["height"] > 10


def test_pause_button_freezes_the_animation(page: Page):
    go(page)
    btn = page.get_by_role("button", name="Pause the home animation")
    btn.click()
    expect(page.get_by_role("button", name="Play the home animation")).to_have_attribute("aria-pressed", "true")
    expect(hero(page)).to_have_attribute("data-paused", "true")
    state = page.evaluate("() => getComputedStyle(document.querySelector('.dh-stage .anim-pop')).animationPlayState")
    assert state == "paused"
    page.get_by_role("button", name="Play the home animation").click()
    expect(hero(page)).not_to_have_attribute("data-paused", "true")


def test_dollhouse_pauses_when_scrolled_away(page: Page):
    go(page)
    page.get_by_role("heading", name="Browse by city").scroll_into_view_if_needed()
    expect(hero(page)).to_have_attribute("data-offscreen", "true")
    page.evaluate("() => window.scrollTo(0, 0)")
    expect(hero(page)).not_to_have_attribute("data-offscreen", "true")


def test_pointer_tilts_the_scene(page: Page):
    go(page)
    settle(page)
    box = hero(page).bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.9, box["y"] + box["height"] * 0.1)
    page.wait_for_timeout(120)
    tz = page.evaluate("() => document.querySelector('.dh-root').style.getPropertyValue('--tilt-z')")
    assert tz and tz != "0deg"


def test_reduced_motion_shows_a_still_scene(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    go(page)
    expect(hero(page)).to_have_attribute("data-static", "true")
    expect(page.get_by_role("button", name=re.compile("home animation"))).to_have_count(0)
    # Everything has landed in its final state: chips and people are fully visible.
    expect(hero(page).get_by_text("Kitchen ✓")).to_be_visible()
    ctx.close()


def test_how_it_works_scenes_play_only_on_screen(page: Page):
    go(page)
    scenes = page.locator("[data-scene]")
    expect(scenes).to_have_count(3)
    scenes.first.scroll_into_view_if_needed()
    expect(page.locator("[data-scene].is-playing")).to_have_count(3)
    page.evaluate("() => window.scrollTo(0, 0)")
    expect(page.locator("[data-scene].is-playing")).to_have_count(0)


def test_room_cards_tilt_towards_the_pointer(page: Page):
    go(page, "/search?city=Bengaluru&near=blr-ecospace")
    wait_idle(page)
    card = page.locator("article").first
    b = card.bounding_box()
    page.mouse.move(b["x"] + b["width"] * 0.85, b["y"] + b["height"] * 0.2)
    page.wait_for_timeout(100)
    assert "rotate" in (card.evaluate("el => el.style.transform") or "")
    page.mouse.move(5, 5)
    page.wait_for_timeout(100)
    assert card.evaluate("el => el.style.transform") == ""


def test_flatmate_cards_flip_and_keep_focus_sensible(page: Page):
    create_profile(page, city="Hyderabad")
    go(page, "/flatmates")
    card = page.get_by_test_id("flatmate-card").first
    card.get_by_role("button", name="How you'd get along").click()
    back = card.get_by_role("button", name="Back to profile")
    expect(back).to_be_focused()
    expect(card.get_by_role("heading", name=re.compile("^You and"))).to_be_visible()
    # The hidden face is out of the accessibility tree and can't be tabbed into.
    expect(card.get_by_role("button", name="View profile")).to_have_count(0)
    back.click()
    expect(card.get_by_role("button", name="How you'd get along")).to_be_focused()


def test_hero_stays_smooth_on_a_slow_cpu(page: Page):
    """Budget-phone check: 4× CPU slowdown, then total blocking time on the main thread over 3 s of animation."""
    cdp = page.context.new_cdp_session(page)
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    page.add_init_script("""
        window.__long = [];
        new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    """)
    page.goto(BASE)
    page.locator("#main h1").first.wait_for()
    page.wait_for_timeout(1000)  # let the app boot; measure the animation period after it
    page.evaluate("() => { window.__long = []; }")
    page.wait_for_timeout(3000)
    tbt = page.evaluate("() => window.__long.reduce((s, d) => s + Math.max(0, d - 50), 0)")
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
    assert tbt < 200, f"main thread blocked for {tbt:.0f} ms during the hero animation"


def test_no_horizontal_scroll_with_the_scene_on_tablets(browser):
    ctx = browser.new_context(viewport={"width": 820, "height": 1000})
    page = ctx.new_page()
    go(page)
    assert page.evaluate("() => document.documentElement.scrollWidth <= innerWidth")
    ctx.close()
