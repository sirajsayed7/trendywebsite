# Trendy creative studio website

This repository contains Trendy's redesigned, responsive studio website. Its desktop homepage follows the approved art direction exactly, while the interface below it stays black and white and photography and film remain in full color. The four featured sectors on the right open interactive project drawers.

## Run

```powershell
npm start
```

Then open `http://127.0.0.1:4187/en`.

The custom Node server supports byte ranges so the local MP4 videos can seek and play normally. It also handles the built-in project enquiry form.

## Contact form delivery

The popup collects name, country-aware phone, email, company, service and a short brief. The phone input keeps the country code separate and validates the local number length for the selected country. It stores submissions locally in `data/contact-submissions.jsonl` by default. To deliver enquiries by email instead, set these environment variables before starting the site:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=hello@example.com
SMTP_PASS=your-password
CONTACT_FROM=hello@example.com
CONTACT_TO=info@trendymedia.org
```

Email delivery uses Nodemailer. The endpoint validates input, includes a honeypot field, limits repeat attempts, and caps request size.

### Recommended management backend: Twenty

For the management portal, use a self-hosted [Twenty CRM](https://github.com/twentyhq/twenty) workspace rather than turning this public website into an admin application. Twenty already provides people, companies, opportunities, custom objects, views, workflows, authentication and REST/GraphQL APIs.

Create an authenticated Twenty HTTP logic function that accepts the contact payload and maps it to a Person plus an Opportunity or custom Enquiry object. Then configure the website server with:

```text
LEADS_WEBHOOK_URL=https://crm.example.com/s/website-enquiry
LEADS_WEBHOOK_TOKEN=your-server-side-token
```

The token stays on the Node server and is never exposed to the browser. SMTP notifications can be enabled alongside the CRM webhook.

## Contents

- `index.html`, `styles.css`, `app.js` — the new responsive homepage
- `assets/approved-home.jpg` — preserved flattened desktop reference/master; the live desktop hero is now segmented in HTML/CSS
- `assets/landing-reference-original.png` — the user-supplied 1672 × 941 landing-page reference used as the pixel source
- `assets/hero-reference-exact-clean-v3.png` — the exact visible hero photograph crop, with baked navigation and the overlapping headline fragment removed
- `assets/hero-reference-monitor-regenerated-v7.png` — the exact approved hero photograph with only the monitor glass replaced by a logo-free generated reflection
- `assets/rail-reference-exact-v1.png` — the complete four-card visual rail extracted pixel-for-pixel from the reference
- `assets/rail-*-exact-v1.png` — individual exact card crops used as project poster fallbacks
- `assets/rail-*-clean-final-v3.png` — ImageGen-cleaned 1600 × 900 rail photography with the UI labels removed; labels remain live HTML
- `assets/hero-doha.png` — the clean art-directed Doha hero source image
- `assets/hero-doha-branded.png` — the mobile hero derivative with the supplied Trendy wordmark composited onto the camera monitor
- `assets/trendy-wordmark-white.png` — the trimmed white wordmark used for the camera treatment
- `assets/trendy-wordmark-black.png` — the trimmed black wordmark used by the segmented desktop hero
- `mirror/assets/` — the original locally stored photography, fonts, and films used by the redesign
- `mirror/pages/` and `mirror/manifest.json` — the preserved source-site capture and route inventory

The original captured project routes remain available through the server. External contact and social links remain external by design.

See `CONTENT_INVENTORY.md` for a human-readable summary of the captured site and `mirror/manifest.json` for the exact machine-readable route and asset inventory.
