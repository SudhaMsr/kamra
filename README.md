# Kamra

**Find a flatmate, not just a flat.** Kamra is a flatshare website for Indian cities. Search rooms by distance from your office or metro station, see how each household fits you on food, guests, smoking and work hours, and message listers without sharing your phone number.

Live site: https://sudhamsr.github.io/kamra/

## Features

- **Search near work**: 20 tech parks, metro stations and business districts across Bengaluru, Hyderabad, Pune, Mumbai, Gurugram, Chennai and Noida. Radius from 1 to 25 km, results sorted by real distance, with a proximity map showing coordinates.
- **Indian house rules as filters**: pure veg or mixed kitchen; girls-only, boys-only or no restriction; guest rules; private room, shared room or PG/hostel; amenities like cook, maid and power backup.
- **Lifestyle fit score** on every room and flatmate, with a per-rule breakdown of matches and clashes.
- **Private messaging**: phone numbers and emails typed into chat are hidden automatically.
- **Visits**: book a slot (8 am to 9 pm, at least 30 minutes ahead); demo listers confirm it.
- **List a room**: a 5-step form with validation, location from a landmark, exact coordinates or your device, flatmate details and up to 6 photos. Edit, pause, mark as let or delete.
- **Trust**: verification badges, report a listing, and a safety page on token scams.
- **Light and dark themes**, installable as an app, works on phones.

This is the demo edition: listings are sample data and anything you add is stored only in your browser. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and the path to a multi-user backend.

## Develop

Requires Node 20+ and Python 3.10+ (for browser tests).

```bash
npm install
npm run build          # outputs dist/
npm run serve          # http://127.0.0.1:4173
npm run typecheck
npm test               # unit tests

pip install pytest playwright && python -m playwright install chromium
npm run test:e2e       # end-to-end tests against the local server
KAMRA_URL=https://sudhamsr.github.io/kamra/ npm run test:e2e   # against the live site
```

## Deploy

Every push and pull request runs `.github/workflows/deploy.yml`: typecheck, unit tests, build and end-to-end tests. Deploying is manual: in GitHub, open **Actions → Test (and deploy on request) → Run workflow**. That runs the same checks, deploys to GitHub Pages, then re-runs the end-to-end suite against the live URL. A failing step stops the deploy.
