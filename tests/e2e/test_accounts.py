"""Accounts: sign-up flow, login, roles, sessions and data isolation between accounts on one device."""
import re

from playwright.sync_api import Page, expect

from conftest import create_profile, go


def test_signup_validates_each_step_before_moving_on(page: Page):
    go(page, "/signup")
    page.get_by_role("button", name="Continue").click()
    expect(page.get_by_text("Choose how you'll use Kamra")).to_be_visible()
    page.get_by_role("radio", name=re.compile("Have a room to fill")).click()
    expect(page.get_by_role("radio", name=re.compile("Have a room to fill"))).to_have_attribute("aria-checked", "true")
    page.get_by_role("button", name="Continue").click()

    page.get_by_label("Email").fill("not-an-email")
    page.get_by_label("Password", exact=True).fill("short")
    page.get_by_role("button", name="Continue").click()
    expect(page.locator("#su-name-err")).to_have_text("Name needs at least 2 characters")
    expect(page.locator("#su-email-err")).to_have_text("Enter a valid email address")
    expect(page.locator("#su-password-err")).to_have_text("Use at least 8 characters")
    expect(page.get_by_label("Your name")).to_be_focused()

    page.get_by_label("Password", exact=True).fill("abcdefgh")
    page.get_by_role("button", name="Continue").click()
    expect(page.locator("#su-password-err")).to_have_text("Include at least one number")
    page.get_by_role("button", name="Show password").click()
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("type", "text")


def test_live_preview_card_fills_in_as_you_answer(page: Page):
    go(page, "/signup")
    preview = page.get_by_role("complementary", name="Preview of your flatmate card")
    page.get_by_role("radio", name=re.compile("Looking for a room")).click()
    expect(preview).to_contain_text("Looking for a room")
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Your name").fill("Meera Nair")
    expect(preview).to_contain_text("Meera Nair")
    page.get_by_label("Email").fill("meera@example.com")
    page.get_by_label("Password", exact=True).fill("Meera2026")
    expect(page.get_by_text("Password strength:")).to_be_visible()
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Age").fill("25")
    expect(preview).to_contain_text("Meera Nair, 25")
    page.get_by_label("What you do").fill("Architect")
    page.get_by_role("radiogroup", name="Gender").get_by_role("radio", name="Woman", exact=True).click()
    page.get_by_role("button", name="Continue").click()
    page.get_by_role("radiogroup", name="What you eat").get_by_role("radio", name="Pure veg").click()
    page.locator("label[for=su-smokes]").click()
    expect(preview).to_contain_text("Pure veg")
    expect(preview).to_contain_text("Smokes")
    # Going back keeps answers.
    page.get_by_role("button", name="Back").click()
    expect(page.get_by_label("What you do")).to_have_value("Architect")


def test_duplicate_email_is_rejected(page: Page):
    email = create_profile(page)
    page.get_by_role("link", name=re.compile("Ananya|Your profile")).first.click()
    page.get_by_role("button", name="Log out").click()
    go(page, "/signup")
    page.get_by_role("radio", name=re.compile("Both")).click()
    page.get_by_role("button", name="Continue").click()
    page.get_by_label("Your name").fill("Someone Else")
    page.get_by_label("Email").fill(email.upper())
    page.get_by_label("Password", exact=True).fill("Another123")
    page.get_by_role("button", name="Continue").click()
    expect(page.locator("#su-email-err")).to_contain_text("already exists")


def test_login_logout_and_wrong_password(page: Page):
    email = create_profile(page, password="Correct123")
    go(page, "/profile")
    page.get_by_role("button", name="Log out").click()
    expect(page.get_by_role("link", name="Log in").first).to_be_visible()

    go(page, "/login")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill("Wrong12345")
    page.get_by_role("button", name="Log in").click()
    expect(page.get_by_role("alert")).to_have_text("That email and password don't match.")
    expect(page.get_by_label("Password", exact=True)).to_be_focused()
    expect(page.get_by_label("Password", exact=True)).to_have_attribute("aria-invalid", "true")

    page.get_by_label("Password", exact=True).fill("Correct123")
    page.get_by_role("button", name="Log in").click()
    expect(page).to_have_url(re.compile(r"#/search"))
    go(page, "/profile")
    expect(page.get_by_role("heading", level=1)).to_have_text("Hi, Ananya")


def test_login_returns_to_where_you_were(page: Page):
    email = create_profile(page)
    go(page, "/profile")
    page.get_by_role("button", name="Log out").click()
    go(page, "/rooms/d003")
    page.get_by_role("button", name=re.compile("^Message")).click()
    expect(page).to_have_url(re.compile(r"#/signup\?next="))
    page.locator("#main").get_by_role("link", name="Log in").click()
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill("Kamra2026!")
    page.get_by_role("button", name="Log in").click()
    expect(page).to_have_url(re.compile(r"#/rooms/d003$"))


def test_too_many_wrong_passwords_locks_briefly(page: Page):
    email = create_profile(page)
    go(page, "/profile")
    page.get_by_role("button", name="Log out").click()
    go(page, "/login")
    page.get_by_label("Email").fill(email)
    for _ in range(5):
        page.get_by_label("Password", exact=True).fill("Nope123456")
        page.get_by_role("button", name="Log in").click()
        expect(page.get_by_role("alert")).to_be_visible()
    page.get_by_label("Password", exact=True).fill("Kamra2026!")
    page.get_by_role("button", name="Log in").click()
    expect(page.get_by_role("alert")).to_contain_text("Too many attempts")


def test_menus_follow_the_chosen_role_and_role_can_change(page: Page):
    create_profile(page, role="Have a room to fill", expect_url=r"#/post")
    main = page.get_by_role("banner").get_by_role("navigation", name="Main")
    expect(main.get_by_role("link", name="Your rooms")).to_be_visible()
    expect(main.get_by_role("link", name="Find a room")).to_have_count(0)
    go(page, "/profile")
    page.get_by_role("radiogroup", name="I'm here because I'm…").get_by_role("radio", name="Looking for a room").click()
    expect(main.get_by_role("link", name="Find a room")).to_be_visible()
    expect(main.get_by_role("link", name="Visits")).to_be_visible()
    expect(main.get_by_role("link", name="Your rooms")).to_have_count(0)


def test_guest_sees_login_and_signup(page: Page):
    go(page)
    header = page.get_by_role("banner")
    expect(header.get_by_role("link", name="Log in")).to_be_visible()
    expect(header.get_by_role("link", name="Sign up")).to_be_visible()


def test_saved_rooms_carry_over_from_guest_to_new_account(page: Page):
    go(page, "/search?city=Pune&near=pun-hinjewadi")
    page.locator("article").first.get_by_role("button", name=re.compile("^Save")).click()
    create_profile(page, city="Pune")
    expect(page.get_by_role("link", name="Saved rooms (1)")).to_be_visible()


def test_two_accounts_on_one_device_keep_separate_data(page: Page):
    create_profile(page, name="First Person", email="first@example.com")
    go(page, "/search?city=Pune&near=pun-hinjewadi")
    page.locator("article").first.get_by_role("button", name=re.compile("^Save")).click()
    expect(page.get_by_role("link", name="Saved rooms (1)")).to_be_visible()
    go(page, "/profile")
    page.get_by_role("button", name="Log out").click()
    expect(page.get_by_role("link", name="Saved rooms (0)")).to_be_visible()
    create_profile(page, name="Second Person", email="second@example.com")
    expect(page.get_by_role("link", name="Saved rooms (0)")).to_be_visible()


def test_reduced_motion_still_completes_signup(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    create_profile(page)
    expect(page).to_have_url(re.compile(r"#/search"))
    ctx.close()
