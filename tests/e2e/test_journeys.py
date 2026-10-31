"""End-to-end user journeys in a real browser."""
import re
from pathlib import Path

from playwright.sync_api import Page, expect

from conftest import BASE, create_profile, go, wait_idle

FIXTURE_IMG = Path(__file__).parent / "fixtures" / "room.png"


def results(page: Page):
    wait_idle(page)
    return page.get_by_role("list", name="Search results").get_by_role("listitem")


def test_home_search_lands_on_results_for_the_chosen_landmark(page: Page):
    go(page)
    expect(page.get_by_role("heading", level=1)).to_contain_text("Find a flatmate")
    page.get_by_label("City", exact=True).select_option("Hyderabad")
    page.get_by_label("Near", exact=True).select_option("hyd-hitec")
    page.get_by_label("Max rent").fill("15000")
    page.get_by_role("button", name="Search").click()
    expect(page).to_have_url(re.compile(r"city=Hyderabad.*near=hyd-hitec.*max=15000"))
    expect(page.get_by_role("heading", level=1)).to_have_text("Rooms near HITEC City")
    assert results(page).count() > 0
    for rent in page.locator("article .font-mono.text-lg").all_inner_texts():
        assert int(re.sub(r"\D", "", rent)) <= 15000


def test_filters_update_url_results_and_survive_reload(page: Page):
    go(page, "/search?city=Bengaluru&near=blr-ecospace&radius=10")
    before = results(page).count()
    side = page.get_by_role("complementary", name="Filters")
    side.get_by_role("button", name="Shared room").click()
    expect(page).to_have_url(re.compile(r"room=shared"))
    side.get_by_role("radiogroup", name="Kitchen").get_by_role("radio", name="Pure veg").click()
    expect(page).to_have_url(re.compile(r"diet=pure-veg"))
    after = results(page).count()
    assert after <= before
    page.reload()
    expect(side.get_by_role("button", name="Shared room")).to_have_attribute("aria-pressed", "true")
    assert results(page).count() == after
    if after == 0:
        expect(page.get_by_role("heading", name="No rooms match yet")).to_be_visible()
    side.get_by_role("button", name=re.compile("Clear 2 filters")).click()
    expect(page).not_to_have_url(re.compile(r"room=|diet="))


def test_garbage_query_params_fall_back_safely(page: Page):
    go(page, "/search?city=Atlantis&radius=-9&max=abc&room=castle&sort=<script>")
    expect(page.get_by_role("heading", level=1)).to_contain_text("Rooms near")
    expect(page.get_by_label("City", exact=True)).to_have_value("Bengaluru")


def test_sort_by_rent_is_ascending(page: Page):
    go(page, "/search?city=Mumbai&near=mum-bkc&radius=25&sort=rent-asc")
    rents = [int(re.sub(r"\D", "", t)) for t in page.locator("article .font-mono.text-lg").all_inner_texts()]
    assert rents and rents == sorted(rents)


def test_profile_adds_fit_scores_and_hides_ineligible_rooms(page: Page):
    create_profile(page, gender="Woman")
    expect(page.locator("article").first.get_by_text(re.compile(r"\d+% fit"))).to_be_visible()
    go(page, "/search?city=Bengaluru&radius=25")
    expect(page.get_by_role("list", name="Search results").get_by_text("Boys only")).to_have_count(0)
    page.locator("article h3 a").first.click()
    expect(page.get_by_role("heading", name="How this flat fits you")).to_be_visible()
    assert page.get_by_text(re.compile(r"· (Match|Clash)")).count() == 6


def test_profile_page_validation_shows_inline_errors(page: Page):
    create_profile(page)
    go(page, "/profile")
    page.get_by_label("Name").fill("A")
    page.get_by_label("Age").fill("15")
    page.get_by_role("button", name="Save profile").click()
    expect(page.get_by_text("Name needs at least 2 characters")).to_be_visible()
    expect(page.get_by_text("You must be 18 or older")).to_be_visible()
    expect(page.get_by_label("Name")).to_have_attribute("aria-invalid", "true")
    expect(page.get_by_label("Name")).to_be_focused()


def test_contact_requires_account_then_returns_to_the_room(page: Page):
    go(page, "/rooms/d001")
    page.get_by_role("button", name=re.compile("^Message")).click()
    expect(page).to_have_url(re.compile(r"#/signup\?next="))
    # Sign up from here; the welcome screen's main action returns to the room.
    page.get_by_role("radio", name=re.compile("Looking for a room")).click()
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Your name").fill("Rohit Shah")
    page.get_by_label("Email").fill("rohit@example.com")
    page.get_by_label("Password", exact=True).fill("Rohit12345")
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Age").fill("27")
    page.get_by_label("What you do").fill("Analyst")
    page.get_by_role("radiogroup", name="Gender").get_by_role("radio", name="Man", exact=True).click()
    for _ in range(4):
        page.get_by_role("button", name=re.compile("Continue|Create account")).click()
    page.get_by_role("link", name="See rooms that fit you").click()
    expect(page).to_have_url(re.compile(r"#/rooms/d001$"))
    expect(page.get_by_role("button", name=re.compile("^Message Arjun|^Message"))).to_be_visible()


def test_messaging_hides_phone_numbers_and_gets_a_reply(page: Page):
    create_profile(page, gender="Man")
    go(page, "/rooms/d001")
    page.get_by_role("button", name=re.compile("^Message")).click()
    dlg = page.get_by_role("dialog")
    dlg.get_by_label("Your message").fill("Hi! Call me on +91 98765 43210 or mail me@test.com")
    dlg.get_by_role("button", name="Send message").click()
    expect(page).to_have_url(re.compile(r"#/messages/"))
    log = page.get_by_role("list", name="Messages")
    expect(log).to_contain_text("[number hidden]")
    expect(log).to_contain_text("[email hidden]")
    expect(log).not_to_contain_text("98765")
    expect(log).to_contain_text("keeps both our numbers private", timeout=5000)
    page.get_by_label("Write a message").fill("Great, can I visit on Saturday?")
    page.keyboard.press("Enter")
    expect(log.get_by_role("listitem")).to_have_count(5, timeout=5000)  # notice + 4 messages
    go(page, "/messages")
    inbox = page.get_by_role("region", name="Messages").or_(page.locator("section[aria-labelledby=inbox-h]"))
    expect(inbox.get_by_role("link")).to_have_count(1)
    expect(inbox.get_by_text("unread")).to_have_count(0)  # opening the thread marked it read


def test_visit_booking_validates_and_confirms(page: Page):
    create_profile(page)
    go(page, "/rooms/d003")
    page.get_by_role("button", name="Book a visit").click()
    dlg = page.get_by_role("dialog")
    dlg.get_by_label("Date and time").fill("2020-01-01T10:00")
    dlg.get_by_role("button", name="Request visit").click()
    expect(dlg.locator("#slot-err")).to_contain_text("at least 30 minutes from now")
    dlg.get_by_label("Date and time").fill("2031-06-12T23:00")
    dlg.get_by_role("button", name="Request visit").click()
    expect(dlg.locator("#slot-err")).to_contain_text("between 8 am and 9 pm")
    dlg.get_by_label("Date and time").fill("2031-06-12T18:30")
    dlg.get_by_role("button", name="Request visit").click()
    expect(page.get_by_role("link", name=re.compile("Visit requested"))).to_be_visible()
    expect(page.get_by_role("link", name=re.compile("Visit confirmed"))).to_be_visible(timeout=5000)
    go(page, "/visits")
    expect(page.get_by_text("Confirmed", exact=True)).to_be_visible()
    page.get_by_role("button", name="Cancel visit").click()
    expect(page.get_by_text("Cancelled", exact=True)).to_be_visible()


def test_save_and_unsave_from_results(page: Page):
    go(page, "/search?city=Pune&near=pun-hinjewadi")
    first = page.locator("article").first
    title = first.locator("h3").inner_text()
    first.get_by_role("button", name=re.compile("^Save")).click()
    expect(page.get_by_role("link", name="Saved rooms (1)")).to_be_visible()
    go(page, "/saved")
    expect(page.get_by_role("heading", name=title)).to_be_visible()
    page.get_by_role("button", name=re.compile("^Remove .* from saved")).click()
    expect(page.get_by_text("Nothing saved yet")).to_be_visible()


def test_report_a_listing_once(page: Page):
    go(page, "/rooms/d010")
    page.get_by_role("button", name="Report this listing").click()
    dlg = page.get_by_role("dialog")
    dlg.get_by_role("button", name="Send report").click()
    expect(dlg.get_by_text("Choose a reason.")).to_be_visible()
    dlg.get_by_label(re.compile("token or fee")).check()
    dlg.get_by_role("button", name="Send report").click()
    expect(page.get_by_role("button", name="You reported this listing")).to_be_disabled()


def test_list_a_room_end_to_end_with_photo_edit_and_pause(page: Page):
    create_profile(page, city="Pune")
    go(page, "/post")
    page.get_by_role("button", name="Continue").click()
    expect(page.locator("#title-err")).to_have_text("Title needs at least 8 characters")

    page.get_by_label("Headline").fill("Sunny room near Hinjewadi Phase 1")
    page.get_by_role("radiogroup", name="Type of room").get_by_role("radio", name="Private room").click()
    page.get_by_label("Rent per month (₹)").fill("12500")
    page.get_by_label("Deposit (₹)").fill("25000")
    expect(page.get_by_text("2.0 months of rent")).to_be_visible()
    page.get_by_label("Describe the room and the flat").fill("Corner room with two windows, a wardrobe and a study table. We are two engineers who cook on weekends.")
    page.get_by_role("button", name="Continue").click()

    expect(page.get_by_role("heading", level=1)).to_have_text("House rules")
    page.get_by_role("radiogroup", name="Kitchen").get_by_role("radio", name="Pure veg").click()
    page.get_by_role("button", name="Gym").click()
    page.get_by_role("button", name="Continue").click()

    expect(page.get_by_role("heading", level=1)).to_have_text("Location")
    page.get_by_role("button", name="Hinjewadi").click()
    page.get_by_label("Latitude").fill("51.5")
    page.get_by_role("button", name="Continue").click()
    expect(page.locator("#lat-err")).to_have_text("That location is outside India")
    page.get_by_label("Latitude").fill("18.5960")
    page.get_by_role("button", name="Continue").click()

    expect(page.get_by_role("heading", level=1)).to_have_text("Flatmates")
    page.get_by_role("button", name="Add a flatmate").click()
    page.get_by_label("First name").fill("Neha")
    page.get_by_label("Work").fill("QA engineer")
    page.get_by_role("button", name="Continue").click()

    expect(page.get_by_role("heading", level=1)).to_have_text("Photos")
    page.locator("#photos").set_input_files(str(FIXTURE_IMG))
    expect(page.get_by_role("img", name="Photo 1 (cover)")).to_be_visible()
    page.get_by_role("button", name="Continue").click()

    expect(page.get_by_text("Everything looks good.")).to_be_visible()
    page.get_by_role("button", name="Publish room").click()
    expect(page).to_have_url(re.compile(r"#/rooms/my"))
    expect(page.get_by_role("heading", level=1)).to_have_text("Sunny room near Hinjewadi Phase 1")
    expect(page.get_by_role("img", name="Photo 1 of 1")).to_be_visible()
    room_url = page.url

    go(page, "/search?city=Pune&near=pun-hinjewadi")
    expect(page.get_by_role("link", name="Sunny room near Hinjewadi Phase 1")).to_be_visible()

    page.goto(room_url)
    page.get_by_role("link", name="Edit listing").click()
    page.get_by_label("Rent per month (₹)").fill("13000")
    for _ in range(5):
        page.get_by_role("button", name="Continue").click()
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_text("₹13,000").first).to_be_visible()

    go(page, "/my-rooms")
    page.get_by_role("button", name="Pause").click()
    expect(page.get_by_text("Paused", exact=True)).to_be_visible()
    go(page, "/search?city=Pune&near=pun-hinjewadi")
    expect(page.get_by_role("link", name="Sunny room near Hinjewadi Phase 1")).to_have_count(0)


def test_session_persists_across_reload_and_account_can_be_deleted(page: Page):
    create_profile(page)
    page.reload()
    go(page, "/profile")
    expect(page.get_by_role("heading", level=1)).to_have_text("Hi, Ananya")
    page.get_by_role("button", name="Delete account").click()
    page.get_by_role("dialog").get_by_role("button", name="Delete account").click()
    go(page, "/profile")
    expect(page.get_by_role("heading", level=1)).to_have_text("Sign up to get fit scores")


def test_flatmates_directory_and_message(page: Page):
    create_profile(page, city="Hyderabad")
    go(page, "/flatmates")
    expect(page.get_by_role("heading", level=1)).to_have_text("People looking in Hyderabad")
    page.get_by_role("button", name="View profile").first.click()
    dlg = page.get_by_role("dialog")
    expect(dlg.get_by_role("heading", name="How you'd get along")).to_be_visible()
    dlg.get_by_role("button", name=re.compile("^Message")).click()
    expect(page).to_have_url(re.compile(r"#/messages/"))


def test_theme_switch_persists(page: Page):
    go(page)
    page.get_by_role("radio", name="Dark theme").first.click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.reload()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.get_by_role("radio", name="Light theme").first.click()
    expect(page.locator("html")).to_have_attribute("data-theme", "light")


def test_unknown_routes_and_missing_rooms(page: Page):
    go(page, "/definitely/not/here")
    expect(page.get_by_role("heading", level=1)).to_have_text("This page doesn't exist")
    go(page, "/rooms/nope")
    expect(page.get_by_role("heading", level=1)).to_have_text("We couldn't find that room")
    go(page, "/post?edit=d001")
    expect(page.get_by_role("heading", level=1)).to_have_text("Sign up to list a room")


def test_mobile_navigation_and_filter_sheet(mobile: Page):
    go(mobile)
    nav = mobile.get_by_role("navigation", name="Main")
    expect(nav).to_be_visible()
    nav.get_by_role("link", name="Search").click()
    expect(mobile).to_have_url(re.compile(r"#/search"))
    mobile.get_by_role("button", name=re.compile("^Filters")).click()
    sheet = mobile.get_by_role("dialog", name="Filters")
    sheet.get_by_role("button", name="PG / Hostel").click()
    expect(mobile).to_have_url(re.compile(r"room=pg"))
    sheet.get_by_role("button", name=re.compile(r"^Show \d+ room")).click()
    expect(sheet).to_be_hidden()
    mobile.get_by_role("tab", name="Map").click()
    expect(mobile.get_by_role("list", name="Rooms on the map")).to_be_visible()
    assert mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    mobile.get_by_role("tab", name="List").click()
    assert mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
