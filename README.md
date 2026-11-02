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

## Navigation

The prototype's top nav (Personalization, Assess, Explore, Tools) is now the second row of the shared hub nav: Overview, Assess, Explore, Tools. Those links are hash routes on this one page (`/personalization-hub#/assess` and so on). The embed sets the hub nav's `data-section` and `aria-current` on every route change, so the right section stays underlined. The hub nav source is `Research Recipe Hub/hub-nav/build.py`.

Routes: `#/`, `#/assess`, `#/opportunities`, `#/opportunities/<id>`, `#/tools`, `#/tools/<id>`, `#/compare`, `#/explore`, `#/guide`, `#/research`, `#/blueprints`. The last three are reachable by URL only, as in the prototype once its footer is gone.

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
