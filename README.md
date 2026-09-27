# Print Media Online — static site rebuild

A self-contained static rebuild of the five public pages of `printmediaonline.com`,
reconstructed from the live site's served markup after the original WordPress
source was lost — plus a fresh **client portal** (sign-in / sign-up / dashboard)
rebuilt from scratch to replace the lost WordPress login.

Everything is in [`site/`](site/). The marketing pages are plain static HTML with
no build step. The portal adds a small set of serverless functions (`site/api/`)
that need Node and, in production, a database — see **Client portal** below.

**Live:** GitHub → [github.com/DeveshM10/ExtraWork](https://github.com/DeveshM10/ExtraWork) ·
deployed on Vercel (project `extrawork`).

---

## What's here

| Page | File | In site menu? |
|---|---|---|
| Home | [`site/index.html`](site/index.html) | yes |
| About Us | [`site/about-us/index.html`](site/about-us/index.html) | yes |
| Services | [`site/services/index.html`](site/services/index.html) | yes |
| Contact Us | [`site/contact-us/index.html`](site/contact-us/index.html) | yes |
| Forms — print order request | [`site/forms/index.html`](site/forms/index.html) | **no — unlinked** |

`forms` is a "Business Card / Letterhead / Envelopes Request Form" page that is
not reachable from the navigation. It was found by querying the site's own
WordPress REST API (`/wp-json/wp/v2/pages`), which enumerates published pages
regardless of whether anything links to them. Worth deciding whether it should
be in the menu — as it stands, customers can only reach it from a direct link.

Supporting files:

- `site/wp-content/` — theme and plugin CSS/JS, images, and the original uploads
  (logos, photography, client logos). Paths are unchanged from the original so
  that stylesheet-internal `url()` references to fonts and icons still resolve.
- `site/wp-includes/` — jQuery and the other WordPress-bundled scripts the
  Elementor front-end depends on.
- `site/assets/fonts/` — Roboto and the icon webfonts, served locally instead of
  from Google Fonts.
- `site/assets/js/form-handler.js` — contact form submission (see below).
- `site/contact.php` — optional mail endpoint for the contact form.

317 files, ~31 MB. No request leaves the server: every stylesheet, script, font
and image is local.

---

## Seven further pages exist, and are deliberately not built

The REST API reports **12** published pages. Five are above. The other seven are
application pages, not content pages, and static HTML cannot honestly reproduce
them:

| Page | What it is | Why it is not here |
|---|---|---|
| `cart`, `checkout` | WooCommerce | Need a shop, stock and a payment gateway. Both are empty on the live site. |
| `my-account` | WooCommerce account area | Needs a user database and sessions. **Already broken live** — the page renders the literal text `[woocommerce_my_account]`, an unprocessed shortcode. |
| `login`, `lost-password` | Sign-in and recovery | Need real authentication. |
| `registration`, `registration-digitate` | Client sign-up — the forms are branded **TCS** and **Digitate** | Need a user database. |

Two things follow from this that the company should weigh in on:

1. **There was a client portal**, with per-client registration for TCS and
   Digitate (their logos are in `wp-content/uploads/2021/10/`). If corporate
   clients still log in to place orders, that is a backend application and a
   considerably larger job than this brochure rebuild. It needs scoping
   separately — and someone should confirm whether it was actually in use, since
   `my-account` has evidently been broken for some time.
2. **These pages were not rebuilt as static mock-ups on purpose.** A login form
   that looks real but authenticates nobody invites people to type real
   passwords into a dead form — worse than the page being absent. If sign-in is
   still needed, it needs a real backend, not HTML that resembles one.

---

## Running it

Any static host works — Netlify, Cloudflare Pages, GitHub Pages, S3, nginx,
Apache, or the existing hosting.

To preview locally:

```bash
cd site
python -m http.server 8000
# then open http://127.0.0.1:8000/
```

Serve it over HTTP rather than opening the files directly; a couple of the
Elementor scripts behave oddly on `file://`.

---

## The contact form — needs one decision

This is the only part of the site that was not a static asset. The original form
posted to WordPress (`wp-admin/admin-ajax.php`), which no longer exists, so
submissions had to be re-plumbed. The form's markup and styling are untouched.

Open [`site/assets/js/form-handler.js`](site/assets/js/form-handler.js) and set
`ENDPOINT` to one of:

1. **`'contact.php'`** (current default) — uses the bundled PHP script. Works on
   any ordinary PHP host, which is what this site was previously on. Set `$TO`
   and `$FROM` at the top of [`site/contact.php`](site/contact.php). `$FROM`
   usually has to be a real mailbox on the domain or the mail will be dropped as
   spoofed. If `mail()` fails, the submission is appended to
   `contact-submissions.log` next to the script so nothing is lost silently.
2. **A full URL** — a Formspree / Web3Forms / Netlify Forms endpoint, if you host
   somewhere without PHP.
3. **Empty string** — falls back to opening the visitor's mail client with the
   fields pre-filled. Works anywhere, but converts poorly.

Please send a real test submission and confirm it arrives before going live.

---

## Client portal (sign-in / sign-up / dashboard)

The original site had a client login (the user icon in the header). That ran on
WordPress and was lost with the rest. It's been rebuilt from scratch as a real,
working auth system rather than a mock — the header user icon now points at
[`/portal/login/`](site/portal/login/).

**Pages** (styled to match the brand — amber on dark, the company's own logo):

- `site/portal/login/` — sign in with username or email
- `site/portal/register/` — create a client account
- `site/portal/dashboard/` — protected; redirects to login without a session

**API** (Vercel serverless, `site/api/auth/`): `register`, `login`, `logout`,
`me`. Passwords are hashed with bcrypt (cost 12); sessions are signed JWTs in an
httpOnly, SameSite=Lax cookie (Secure in production). Sign-in accepts a username
or an email, and returns the same message for a wrong password as for an unknown
user, so the form can't be used to discover which usernames exist.

### Two environment variables to set before it's production-ready

| Var | Purpose | If unset |
|---|---|---|
| `SESSION_SECRET` | Signs session cookies. Use a long random string. | Dev-only fallback locally; **the API refuses to sign sessions in production**, so login won't work until it's set. |
| `DATABASE_URL` | Postgres connection string (Vercel Postgres, Neon, Supabase, … all work). | Falls back to a temp-file store — fine for local `vercel dev`, but on Vercel `/tmp` is per-instance and wiped, so **accounts won't persist** until this is set. |

Set both in Vercel → Project → Settings → Environment Variables, then redeploy.
Creating a Vercel Postgres store from the dashboard sets `DATABASE_URL` for you.
The `portal_users` table is created automatically on first use.

### Running the portal locally

```bash
cd site
npm install
vercel dev          # serves the static pages + the /api functions together
# open http://localhost:3000/portal/register/
```

(Plain `python -m http.server` serves the pages but not the API, so login won't
work under it — use `vercel dev` for the full flow.)

### Note on the old credentials

The old portal's `TCS` / `businesscard` login belonged to the previous
WordPress install and is deliberately **not** carried over — hard-coding a known
username/password into a public repo would be a security hole. The new system is
sign-up based: clients create their own accounts. (That old password should be
treated as compromised now that it's been shared in plain text.)

---

## Fidelity

Each page was rendered in headless Chrome at 1440px wide and compared
pixel-by-pixel against the live site:

| Page | Differing pixels |
|---|---|
| Forms | 0.00% |
| Contact | 0.01% |
| Services | 0.02% |
| About | 0.05% |
| Home | 1.19% |

The home page figure is the animated client-logo carousel, which lands on a
different frame on every load. As a control, two consecutive captures of the
**live** site were compared against each other: they differ by 2.43%, i.e. the
live site differs from itself more than this rebuild differs from it. The
remaining sub-0.1% on the other pages is JPEG and anti-aliasing noise.

Hover states, scroll-triggered entrance animations, the services tab widget and
the logo carousel all run from the original scripts, so they behave as before.

---

## Deliberate changes

Kept out because it would break, leak, or dangle on a static host:

- WordPress REST/oEmbed/RSS discovery `<link>` tags, and the `xmlrpc.php` EditURI.
- The emoji loader, which fetched from `s.w.org` on every page load.
- The WooCommerce cart-fragments AJAX poller, which would 404 every load. The
  rest of WooCommerce's CSS is kept, since it participates in the cascade.
- A `W3 Total Cache` HTML comment that disclosed the caching plugin, the server
  hostname and a server-side timestamp.
- `/login/` and `/cart/` — WooCommerce pages with no content in this build. Both
  now point at Contact. If the shop is coming back, these need real pages.

Left in place: some inert JavaScript config strings still contain
`printmediaonline.com` URLs (`admin-ajax.php`, a JetTabs template API URL,
unused particle-effect asset paths). Nothing fetches them — the tab content is
server-rendered inline — but they are harmless to tidy if you prefer.

---

## Two things to check before launch

**Asset provenance.** The image set includes stock photography (several
`pexels-*` files), a graphic sourced from a free-PNG site, and 33 third-party
company logos in the "Clients we worked with" band. These came off the live site
and are reproduced as they were, but they were not necessarily licensed
correctly in the first place. Worth confirming the stock licences are held, and
that those client logos are used with permission.

**Server-side security.** While pulling the pages down, the live site's sitemaps
turned out to be serving spam. This rebuild is clean — the finding is about the
existing server, not this code — but it needs attention before anything is
migrated or relaunched. See [`SECURITY-NOTES.md`](SECURITY-NOTES.md).

---

## If you want WordPress back

This rebuild is intentionally static: it is portable, fast, has no attack
surface worth speaking of, and needs no plugin licences. For a brochure site of
four pages that is usually the right trade.

The cost is that non-technical staff can't edit it in an admin panel. If that
matters, the options are roughly:

- Re-create the four pages in Elementor on a **fresh, clean** WordPress install.
  Note this needs an active **Elementor Pro** licence, plus JetTabs, Happy
  Addons and Ultimate Addons — the original used widgets from all of them.
- Put the static pages behind a Git-based CMS (Decap, Sveltia) for text edits
  without a WordPress stack.

Either way, do not migrate the old install forward. See the security notes.
