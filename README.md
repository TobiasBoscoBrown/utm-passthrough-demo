# UTM Passthrough Demo — Framer → Shopify → Seal Subscriptions

This is a working proof-of-concept that demonstrates how to preserve UTM attribution parameters across the split-domain setup used by Vawk Creative:

- **Framer landing page** at `celltheory.com`
- **Shopify checkout** at `shop.celltheory.com`
- **Seal Subscriptions** widget handling subscription checkouts

## The Problem

When visitors land on a Framer page with UTM parameters (e.g. from a Google Ads campaign), those parameters are often lost during the transition to the Shopify checkout. This breaks attribution in Google Analytics and ad-platform conversion tracking.

## Job Expectations — How This Demo Satisfies Each One

| # | Client Expectation | How this demo delivers |
|---|---|---|
| 1 | **Analyze the existing setup** with Framer at `celltheory.com` and Shopify checkout at `shop.celltheory.com`. | I scraped the live `celltheory.com` Framer site and its `/my-store/` product page, found the existing UTM handler, and documented its specific flaws (see below). |
| 2 | **Implement a reliable solution** to preserve UTM parameters during the domain transition. | `utm-preserver.js` uses three redundant mechanisms: URL decoration on outbound links, a root-domain `.celltheory.com` cookie, and `localStorage`. |
| 3 | **Ensure the solution works with the existing GTM** installed on both domains. | The library pushes a `utm_parameters_captured` event to `window.dataLayer` with all UTM values, so existing GTM tags can fire immediately. |
| 4 | **Address the Seal Subscriptions component** that handles the subscription checkout flow. | The subscription checkout step reconstructs UTM parameters from the decorated URL and the shared root-domain cookie, preserving attribution for subscription conversions. |
| 5 | **Provide documentation or guidance** on the implemented fix. | This README and the live demo page explain the problem, the implementation, and the exact steps to apply it to the real site. |

## What I Found on the Live Site

The current `celltheory.com` page already contains a UTM script that:

- Only decorates links matching `shop.celltheory.com` or `celltheory.com/cart`.
- Stores values in `sessionStorage`, which is **not** shared across domains.
- Does not push captured UTMs to the GTM `dataLayer`.
- Uses a `setInterval(..., 500)` loop to rewrite links continuously.

The real CTAs point to `/my-store/cell-theory-triple-action-nad-multicellular-longevity-supplement` (same-domain Framer path), and the product page hydration data includes a **Seal Subscriptions** selling plan. My solution fixes the selector mismatch, replaces `sessionStorage` with a cross-domain root-domain cookie, and adds GTM integration.

## The Solution

`utm-preserver.js` runs on every page and does three things:

1. **Captures UTM parameters** from the URL as soon as the page loads.
2. **Persists them** in two places:
   - `localStorage` for the current hostname.
   - A root-domain cookie on `.celltheory.com` so both `celltheory.com` and `shop.celltheory.com` can read the same values.
3. **Pushes the values to the GTM `dataLayer`** as `utm_parameters_captured`.
4. **Decorates outbound links** to `shop.celltheory.com` so the UTM parameters are also carried through the URL.

Shopify checkout and the Seal Subscriptions widget then read the UTM values from either the URL or the shared root-domain cookie, restoring attribution across the entire funnel.

## Files

| File | Purpose |
|------|---------|
| `utm-preserver.js` | Shared UTM capture, storage, and link-decoration library |
| `framer-page.html` | Simulated Framer landing page on `celltheory.com` |
| `shopify-checkout.html` | Simulated Shopify checkout on `shop.celltheory.com` |
| `subscription-checkout.html` | Simulated Seal Subscriptions subscription checkout |
| `server.js` | Serves the Framer page on port 3000 and the Shopify pages on port 3100 |
| `playwright-demo.spec.ts` | Automated end-to-end proof that UTM params survive the whole flow |

## Run the Demo

```bash
cd utm-passthrough-demo
node server.js
```

Then open the Framer landing page with UTM parameters:

```
http://localhost:3000/?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=supplements&utm_content=ad_variation_1
```

Click **Shop Now** and then **Subscribe & Save**. Each page will show the UTM parameters preserved.

## Run the Automated Proof

From the repository root (Playwright is already configured for the `rumm-e2e` project):

```bash
npx playwright test utm-passthrough-demo/playwright-demo.spec.ts
```

The test will:

1. Start the demo server.
2. Load the Framer page with UTM parameters.
3. Assert that the outbound link is decorated with UTM parameters.
4. Click through to the Shopify checkout and assert all UTM values are present.
5. Click through to the Seal Subscriptions checkout and assert all UTM values are still present.
6. Verify that a root-domain cookie was set by the Framer page.

## How to Apply This to the Real Site

1. Add `utm-preserver.js` to the Framer site via a custom code embed (or to the site’s `<head>`).
2. Add `utm-preserver.js` to the Shopify theme (typically in `theme.liquid` or via GTM).
3. Ensure any Seal Subscriptions buttons or links use the decorated URLs, or read the cookie/root-domain storage.
4. Configure GTM triggers to fire on the `utm_parameters_captured` event and use the UTM values in conversion tags.

## Why This Approach Works

- **URL decoration** is the most reliable passthrough mechanism for direct links.
- **Root-domain cookies** cover cases where users navigate indirectly or where a widget loads cross-origin resources.
- **localStorage** keeps the values accessible on the same domain for the current session.
- **GTM dataLayer integration** gives the marketing team full control over attribution tags without requiring code changes.
