# Security notes on the live printmediaonline.com server

Found incidentally while pulling the pages down for the rebuild, on 2026-09-27.
Flagging it because it affects what you should do with the existing hosting.

**The static rebuild in this repository is not affected.** Its markup was scanned
and is clean. This is about the live WordPress server.

---

## What was observed

**1. The sitemaps serve spam.**

Three sitemap paths were requested:

- `https://printmediaonline.com/wp-sitemap.xml`
- `https://printmediaonline.com/sitemap.xml`
- `https://printmediaonline.com/sitemap_index.xml`

All three returned `200 OK` with a list of URLs that have nothing to do with a
printing business — consumer e-commerce product pages (clothing, RC batteries,
hardware, jewellery, and some adult products), each on the site's own domain,
in the shape `/<6-7 digits>/<Product-Name-Slug>`.

Three properties make this more than untidy SEO:

- **The content changes on every request.** Each fetch returned a different
  random set of URLs. These are not static files — something is generating them
  per request.
- **All three filenames return it,** including `sitemap_index.xml`, which
  WordPress core does not serve. A handler is intercepting the requests.
- **Every entry is stamped `lastmod` = today, `changefreq` daily,
  `priority` 0.8** — tuned for crawl frequency, not accuracy.

**2. The advertised URLs 404 for ordinary visitors.**

Fetching one of them with a normal browser user-agent returns the site's own
`404` page. So the injected URLs are being fed to search engines while returning
nothing to humans — the usual shape of a cloaked spam campaign, where the real
payload is served only to crawlers.

I could not confirm the crawler-facing side directly: requesting with a
`Googlebot` user-agent returned `HTTP 466` from a WAF in front of the site.
Blocking spoofed crawler UAs is correct behaviour, so this is not itself a
problem — it just means the cloaked variant could not be inspected from outside.

**3. The plugin stack is roughly three years out of date.**

Core is current (WordPress 6.9) but the rest is not:

| Component | Installed | Released |
|---|---|---|
| WooCommerce | 7.0.0 | late 2022 |
| Elementor | 3.7.8 | 2022 |
| Elementor Pro | 3.7.7 | 2022 |
| WPForms | 1.7.6 | 2022 |

Elementor Pro in particular has had authenticated-RCE and arbitrary-file-upload
advisories in this range. Combined with the footer copyright still reading 2022,
the picture is an install that stopped being maintained when the previous
developer left — which is consistent with how the spam got in.

---

## Interpretation

Taken together — per-request generated sitemaps, a handler responding on a
filename core does not use, injected URLs cloaked from human visitors, and an
unpatched 2022-era plugin stack — this reads as a **compromised install being
used for parasite SEO**: the domain's search reputation is being rented out to
push spam product pages.

I have not had server access, so this is inference from external behaviour, not
a confirmed diagnosis. It is consistent enough to act on.

Two consequences worth knowing:

- Google may already have indexed these URLs under the company's domain. That
  risks a manual action or a "hacked site" label in Search, which damages the
  domain's standing for the legitimate pages.
- Whatever wrote the sitemap handler has code execution on the host. Assume
  anything reachable from that account is exposed.

---

## Recommended sequence

**Do not migrate the existing WordPress install, its database, or its
`wp-content` forward.** Copying it over carries the backdoor with it. The static
rebuild here was reconstructed from rendered output, so it is a clean break by
construction — that property is worth keeping.

In rough priority order:

1. **Preserve evidence before changing anything** — snapshot the filesystem and
   database. If you clean first, you lose the ability to find out what happened.
2. **Rotate every credential** the old install touched: hosting panel, SFTP/SSH,
   database, all WordPress admin accounts, and any SMTP or API keys in
   `wp-config.php`. Assume all are known to the attacker.
3. **Audit for persistence** — look for unexpected admin users, modified
   `.htaccess`, unknown files in `wp-content/mu-plugins/` (a common hiding place,
   as it auto-loads), scheduled tasks, and anything hooking sitemap generation.
4. **Deploy the clean static site** to fresh hosting rather than cleaning in
   place. Rebuilding beats disinfecting; you can be confident about the former.
5. **In Google Search Console**, check Security Issues, then request removal of
   the injected URLs and resubmit a correct sitemap. If a manual action is
   present, file reconsideration once the site is clean.
6. **Have someone with server access confirm the diagnosis.** Everything above
   was observed from outside. A host-side look at access logs around the sitemap
   handler would establish what actually happened.

If the company would rather have this verified properly, this is the point at
which an incident-response specialist is worth the money — the external view
can't tell you how far in the intrusion went.
