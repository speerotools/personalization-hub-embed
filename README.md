# Speero Personalization Hub: Embed

TL;DR: one Code Embed on `/personalization-hub` runs the whole hub (overview, maturity assessment, opportunity explorer and detail, tools, tool detail, compare, explorer library). It is a port of Nick's prototype with the same copy on every route, minus the prototype's own header and footer. Data comes from `personalization-hub-data`, never from this repo.

```
https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-embed@v1.0.5/dist/embed.js
https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-embed@v1.0.5/dist/embed.css
```

## Webflow install

The page carries the shared Hub Nav component (Hub `personalization`, Section `overview`, Ground `light`) directly under the site header, then one Code Embed:

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-embed@v1.0.5/dist/embed.css">

<div id="speero-personalization-hub"></div>
<script src="https://cdn.jsdelivr.net/gh/speerotools/personalization-hub-embed@v1.0.5/dist/embed.js" defer></script>
```

Pin a version: a release tag, or a full commit hash (equally immutable on jsDelivr). `@main` is mutable and jsDelivr caches it, so a rollback would not reach the site. The live page is pinned to `@9e095ac9e5afbbf6320e47671b9823136ae55ae6`, because tags `v1.0.4` to `v1.0.6` all point at the earlier commit `927cd49`. When tagging, create the tag on the newest commit of `main`.

## Native page content

The Webflow page carries, outside the embed, a block marked `data-ph-native-head` (the page's H1 and intro) and a section marked `data-ph-native-dir` (Collection Lists of every opportunity and tool, linked to their CMS pages). Crawlers and no-JS visitors read those. The embed hides both once its first view has rendered, so with JavaScript the page shows exactly the prototype, with one H1. If the data fetch fails they stay visible.

## Pages and navigation

Like the Research hub, each main view is its own Webflow page, so search engines see it as a page:

| View | URL | Embed config |
|---|---|---|
| Overview | `/personalization-hub` | `defaultRoute: ""` |
| Assess | `/personalization-assessment` | `defaultRoute: "assess"` |
| Explore | `/personalization-opportunities` | `defaultRoute: "opportunities"` |
| Tools | `/personalization-tools` | `defaultRoute: "tools"` |
| Opportunity, tool | `/personalization-opportunities/<slug>`, `/personalization-tools/<slug>` | CMS template pages |

Every page sets the same `pages` map, so links between views use real URLs. Filters stay in the hash on their own page (`/personalization-opportunities#?stage=discovery`), which keeps refresh and Back working and keeps filtered variants out of the index. Compare, the library explorer, guide, research and blueprints stay hash views on the Overview page (`/personalization-hub#/compare`). Old hash links such as `/personalization-hub#/assess` redirect to the real page.

The prototype's top nav (Personalization, Assess, Explore, Tools) is the second row of the shared hub nav, linking to those pages. The embed also keeps the nav's `data-section` and `aria-current` in step with the view. The hub nav source is `Research Recipe Hub/hub-nav/build.py`.

With `pages: null` (the default, and `test-hub.html`) every view is a hash route on one page. `test/*.html` mirrors the Webflow setup with one local page per view.

## Config

`window.PERSONALIZATION_HUB_CONFIG = { ... }` before the script.

| Key | Default | What it does |
|---|---|---|
| `dataUrl` | the published CDN JSON | Where the data comes from |
| `assetBase` | the folder of `dataUrl` | Where tool logos are read from |
| `mount` | `"speero-personalization-hub"` | Id of the element to render into |
| `defaultRoute` | `""` | View to open with no hash |
| `opportunityBase` | `null` | `null` keeps opportunity detail inside the embed. Set to `"/personalization-opportunities/"` once the CMS template is designed |
| `toolBase` | `null` | Same for tools, `"/personalization-tools/"` |
| `pages` | `null` | `{ home, assess, opportunities, tools }` page URLs. See Pages and navigation |

Switch both bases on together with the CMS templates. Until then the CMS item pages are unstyled, and once they are styled the same content should not also live at a hash URL.

## Kept from the prototype fixes

Filters live in the URL (`#/opportunities?model=b2b&stage=discovery`), so refresh and Back restore them, and filter changes replace the history entry instead of stacking one per keystroke. Compare is capped at three tools with a status message. Every search field has a label. Compare list, audit answers and business choice persist per browser in `localStorage`, wrapped so a blocked storage only means they last for the visit.

## Local testing

```bash
python3 -m http.server 8766 --directory ~/Documents/Speero
open "http://localhost:8766/Personalization%20Hub/personalization-hub-embed/test-hub.html"
```

The test page mounts the generated hub nav above the embed, reads the local data file, and cache-busts both assets. `?nav=off` drops the nav.

## Releasing

```bash
git tag v1.0.6 && git push --tags
```

Then bump the tag in the Webflow embed and publish. CSS is scoped under `#speero-personalization-hub`, so it cannot reach the rest of the page.
