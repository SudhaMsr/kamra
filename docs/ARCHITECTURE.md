# Kamra — architecture

Kamra is a flatshare website for Indian cities. People search rooms by real distance from a tech park or metro station, see how each household fits their lifestyle (kitchen, guests, smoking, drinking, work hours, budget), and contact listers without exposing their phone number.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 + TypeScript (strict) | Typed components; stable ecosystem |
| Styling | Tailwind CSS v4 with a custom token-based design system | No template UI kit; one palette drives light and dark themes |
| Icons | Lucide (via react-icons/lu) | Consistent stroke icons |
| Validation | zod | One schema validates forms, URL queries and stored data |
| Build | esbuild + Tailwind compiler (`scripts/build.mjs`) | ~300 ms builds, content-hashed assets for safe caching |
| Hosting | GitHub Pages | Static, free, HTTPS |
| Tests | Node test runner (unit), pytest + Playwright in Chrome (end-to-end, accessibility) | Real-browser coverage of every journey |
| CI/CD | GitHub Actions | Typecheck → unit → build → e2e → deploy → e2e on the live URL |

## Layout of the code

```
src/
  domain/      pure logic, no React: types + zod schemas, landmarks, geo maths, fit scoring, search, contact redaction
  data/        demo dataset (seeded generator) and the client store
  lib/         hash router, formatting, image compression, theme, error messages
  components/  design-system pieces: Layout, ListingCard, ProximityMap, dialogs, fields, badges
  pages/       one module per screen
  main.tsx     routes + error boundary
tests/
  unit/        domain tests (geo, privacy, fit, search, validation, demo-data integrity)
  e2e/         journeys, accessibility audit, contrast, keyboard, mobile layout
```

Dependencies point one way: `pages → components → data → domain`. Domain code has no browser or React dependencies, so it is unit-tested in Node and can move to a server unchanged.

## Key decisions

- **Hash routing.** GitHub Pages has no server rewrites. `#/rooms/d001` deep-links, refreshes and shares correctly.
- **URL is the search state.** Every filter lives in the query string, so a search can be bookmarked or sent to a friend. Bad or hostile values are parsed by zod with safe fallbacks instead of erroring.
- **Distance search.** Haversine great-circle distance from the chosen landmark, filtered by radius and sorted by distance, rent, newness or fit. The proximity map uses a local equirectangular projection, accurate to metres at city scale.
- **Gender rules are hard filters, lifestyle is a score.** You never see a girls-only room if you're a man, but a guests clash only lowers the fit score.
- **Phone privacy.** Messages pass through `redactContacts`, which masks Indian mobile numbers in common formats (+91, 0-prefix, spaces, dots, dashes), emails and spelled-out numbers. Rents, dates and pincodes are left alone (unit-tested).
- **Resilient storage.** Stored data is re-validated on load; corrupt data is backed up and replaced instead of crashing. Quota errors (large photos) surface a clear message. Open tabs stay in sync through the `storage` event. Private-mode browsers fall back to memory with a warning.
- **Photos** are resized to 1280 px and re-encoded as JPEG in the browser before storage.
- **Accessibility.** Skip link, one `h1` per page, focus moves to the page on navigation, labelled controls with linked error messages, radio groups with arrow-key support, native `<dialog>` with a focus trap, keyboard-reachable map pins, WCAG AA contrast in both themes, reduced-motion support. All enforced by the e2e suite.

## Accounts

One account per person, with a role chosen at sign-up: looking for a room, have a room to fill, or both. The role
decides the navigation and where people land after logging in, and can be changed from the profile page. Passwords
are hashed with PBKDF2-SHA256 (210,000 iterations, random 16-byte salt) and compared in constant time; login is
throttled for 30 seconds after five failures. Each account has its own data bucket; a guest bucket holds rooms saved
before signing up and moves into the new account. Data from v1 (single profile, no login) is migrated on load.

## Motion

One easing curve and three durations (160 / 320 / 520 ms) in `src/styles.css`. Only opacity and transform animate.
Entrances use CSS keyframes with fill-mode `both`; one-off feedback (form shake) uses the Web Animations API so
elements aren't remounted and keep focus. Everything collapses to its end state under `prefers-reduced-motion`.

## Demo edition and the path to multi-user

This edition stores user data in the browser (`src/data/store.ts`) and ships a deterministic demo dataset of rooms and flatmates across 7 cities. To run Kamra for real users:

1. Stand up Postgres with PostGIS (e.g. Supabase). Store `location geography(Point, 4326)` with a GiST index; radius search becomes `ST_DWithin` ordered by `<->`.
2. Keep phone numbers in a separate table that client roles cannot read; route messages by user UUID only.
3. Replace the functions exported by `src/data/store.ts` with API calls of the same shape. Pages don't change.
4. Add server-side verification (DigiLocker for ID, work-email OTP) and moderation for reports.
