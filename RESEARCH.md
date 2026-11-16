# Wolt web — how it works (research for a custom MCP)

Date: 2026-11-16. Source: REA browser capture of wolt.com (Evidence `ev_e2b103f0…aeb89`), direct API calls, and static reading of 111 JS bundles (web app v1.16.158).

Legend: ✅ tested live (no login) · 📄 seen in site code only, not called · ❓ unknown

## Hosts

| Host | Used for |
|---|---|
| `consumer-api.wolt.com` | discovery, search, venue, menu, baskets, checkout |
| `restaurant-api.wolt.com` | config, address fields, older endpoints (many now `410 Gone`) |
| `authentication.wolt.com` | login (`/v1/wauth2/...`) |
| `wolt.com/v1/...` | geo-ip, country list |

No API key needed for read-only calls. Plain browser User-Agent was enough.

## Read-only (no login) — ready for MCP

| What | Call | Status |
|---|---|---|
| Venues near a point | `GET consumer-api/v1/pages/restaurants?lat&lon` → `sections[1].items[].venue` (slug, name, rating, estimate_range, price_range, tags, online). Tbilisi center: 1,361 venues, ~2.7 MB | ✅ |
| Front page (stores, promos) | `GET consumer-api/v1/pages/front?lat&lon` | ✅ |
| Search | `POST consumer-api/v1/pages/search` body `{"q":"pizza","target":null,"lat":..,"lon":..}` → sections `venues` + `items` | ✅ |
| Venue live status | `GET consumer-api/order-xp/web/v1/venue/slug/{slug}/dynamic/?lat&lon&selected_delivery_method=homedelivery` → open/close times, delivery configs, order minimum | ✅ |
| Full menu | `GET consumer-api/consumer-assortment/v1/venues/slug/{slug}/assortment?language=en` → `categories[]`, `items[]` (price in tetri, 2600 = 26.00 GEL), `options[]` (choice groups with min/max) | ✅ |
| Menu item search inside venue | `.../assortment/items/search`, `.../assortment/categories/slug/{cat}` | 📄 |
| Venue static page | `order-xp/web/v1/pages/venue/slug/{slug}/static` | 📄 (the path without `/pages` gave 404) |
| Cities | `/v1/cities`, `/v1/cities/{id}/districts` | 📄 |

Menu language: `?language=en|ka|ru|de|fr` (non-Georgian is auto-translated).

## Login

- Tokens are stored in cookies `__wtoken` (access) and `__wrtoken` (refresh), 365-day cookies. API calls send `Authorization: Bearer <access>`. 📄
- Refresh: `POST authentication.wolt.com/v1/wauth2/access_token`, form-encoded, `grant_type=refresh_token&refresh_token=...`. 📄
- Logging in starts with a phone SMS (`/v2/wauth2/consumer-sms/start-phone-number-authentication`) or an email magic link (`/v3/users/email_login`). **Both need an hCaptcha token** (`h-captcha-response` header). 📄
- **What this means for the MCP:** it can't log in by itself. You log in once in a browser, then give the MCP your `__wrtoken`. It refreshes the access token from there.

## Cart and checkout (needs login)

| What | Call | Status |
|---|---|---|
| Create/update basket | `POST order-xp/v1/baskets` body `{items, venue_id, currency}` → `{id, venue_id}` | 📄 |
| List / count / delete baskets | `GET order-xp/web/v1/pages/baskets?lat&lon`, `/order-xp/v1/baskets/count`, `POST /order-xp/v1/baskets/bulk/delete` | 📄 |
| Checkout preview (prices, fees, tip) | `POST order-xp/web/v2/pages/checkout` body `{purchase_plan}` | 📄 |
| Place order (pay) | ❓ The code for this only loads on the checkout page, and the capture never reached it. Getting it needs one logged-in capture. | ❓ |
| Order history / tracking | `order-xp/web/v1/pages/orders`, `/v2/order_details/purchase/{id}`, `/order-tracking/v1/unified/marketplace/{order_pdrn}` | 📄 |
| Saved payment methods | `/v3/user/me/payment_methods`, `/v1/payment-methods/profile` | 📄 |
| Group orders | `/v1/group_order/...` (create, join, basket, purchase) | 📄 |

## Suggested MCP tools

Phase 1 (no login, works today):
- `wolt_list_venues(lat, lon, filter?)`: a trimmed list, because the raw response is 2.7 MB
- `wolt_search(query, lat, lon)`
- `wolt_venue_status(slug, lat, lon)`
- `wolt_get_menu(slug, language="en")`: flattens categories, items and option groups

Phase 2 (uses your `__wrtoken`):
- `wolt_cart_add / wolt_cart_view / wolt_cart_clear`
- `wolt_checkout_preview`: shows the total, delivery fee and ETA
- `wolt_orders / wolt_track_order`

Phase 3 (optional): `wolt_place_order`. It always shows the full total and asks you to confirm first. Needs the missing endpoint from a logged-in capture.

## Risks

- This is a private API. Wolt can change it at any time; several old `restaurant-api` paths already return 410.
- Automating Wolt this way may break their terms of service. Keep it to personal use, at low request rates.
- Login and some actions are protected by hCaptcha. Don't try to get around it.
