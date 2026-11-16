# wolt-mcp — design spec

Date: 2026-11-16 · Version 2 (after the full interview) · Status: awaiting user approval
Research: [RESEARCH.md](../../../RESEARCH.md)

Endpoint status used below: ✅ tested live · 📄 seen in Wolt's site code only · ❓ unknown.

## 1. Goal

An open-source, unofficial MCP server that lets an AI agent browse Wolt, manage addresses, build a cart, place an order and follow it, on the user's own Wolt account. Each user installs it on their own machine. Nothing is hosted; no session leaves the user's computer.

Priorities, in order: safety of the user's money and account, agent experience (AX), developer experience (DX), maintainability.

## 2. Non-goals

- Hosted or multi-tenant service.
- Ordering with nobody present. A person always clicks Confirm.
- Group orders, chatting with support, adding payment cards, creating accounts.
- Bypassing captcha or any Wolt bot protection. Every human check is handed to the user.
- Driving the wolt.com UI with a browser robot.
- Multiple Wolt accounts, Wolt+ management, ready-made prompts, desktop notifications (later).

## 3. Distribution and setup

- npm package `wolt-mcp-server` (the name `wolt-mcp` is taken on npm by an unrelated project); the installed command is also available as `wolt-mcp`. Node 20+, stdio. Described everywhere as "unofficial, not affiliated with Wolt".
- Repo stays private (`SyntaxFear/wolt-mcp-server`) until browsing, account and ordering all work and are tested. Then GitHub and npm go public together.
- `npx wolt-mcp-server setup`: registers the server in the clients the user picks (Claude Code, Codex, Cursor, Claude Desktop), then asks for language, optional spending limits, optional food preferences, and offers login. Every question can be skipped.
- Other commands: `login`, `logout` (wipes the stored session), `status`, `doctor`, `limits` (change spending limits), `config`.
- Platforms at first public release: macOS, Windows and Linux.
- Countries: built for every Wolt country (currency, language and address fields come from Wolt). Tested for real in Georgia only; README says so.
- Config file `~/.config/wolt-mcp/config.json` (platform equivalent on Windows): language, location, limits, food preferences, image mode, read-only mode. No secrets in it.

## 4. Login

Wolt has no password. Login is an SMS code or an email link, both behind hCaptcha. The MCP never asks for credentials; it stores the session (refresh token) in the OS keychain.

### 4.1 Getting a session

Used by `login`, `setup`, and on demand (4.2). Stops at the first step that succeeds:

1. **Keychain:** a stored session that still refreshes.
2. **Existing browser session:** read the Wolt cookies (`__wtoken`, `__wrtoken`) straight from the user's default browser, then other installed browsers. The OS may show its own permission prompt (on macOS, the "Chrome Safe Storage" keychain prompt). If several profiles hold a Wolt session, ask which one.
3. **Login in the default browser:** open the Wolt login page there, tell the user to log in, and poll that browser's cookie store until the session appears (timeout 5 minutes).
4. **Fallback login window:** if the cookie store cannot be read (Safari, denied prompt, unsupported browser), launch an installed Chromium-family browser with a dedicated profile, let the user log in there, and read the cookies from that window.
5. **Manual:** `wolt-mcp login --token` takes a pasted refresh token, for headless machines.

The session is saved to the keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service). With no keychain available, fall back to a user-only-readable file and warn.

### 4.2 Login on demand

Browsing tools never ask for login. When a tool that needs the account is called without a valid session:

1. Run 4.1 automatically. The tool reports "Waiting for you to log in to Wolt in your browser" while step 3 or 4 is open.
2. When the session arrives, the original request continues by itself.
3. On timeout or refusal, return `LOGIN_REQUIRED` with the exact command to run.

The same flow runs when a session expires or is revoked mid-use.

### 4.3 Keeping the session

- Access token refreshed via `POST authentication.wolt.com/v1/wauth2/access_token` (`grant_type=refresh_token`) 📄 shortly before expiry.
- Refresh is guarded by a cross-process lock and re-reads the keychain after taking it, so two clients never burn each other's rotated token.
- Wolt's "new device" confirmation 📄 is handed to the user in the browser.

## 5. Behaviour decisions

### 5.1 Addresses and location

- **Full management** of the addresses saved in the Wolt account: list, pick, add, edit, delete.
- **Details** on every address: apartment, floor, entrance, door code, building name, courier note, label (Home, Work, other). The exact fields come from Wolt's per-country address-field endpoint ✅.
- **New address:** search the typed text, return the top matches with full text; the user picks one. If the building is not found, accept a map link or coordinates. Then collect the details. Never auto-pick the first match.
- **Default:** when the user does not say where, use the last-used or Wolt-default address and always show it in the preview. Before login, browsing uses the location set with `wolt_set_location`; with none set, tools return `LOCATION_REQUIRED`.
- **Address change with a filled cart:** keep the cart if Wolt allows it, re-check that the venue delivers to the new address, and tell the user the new fee and delivery time. If it no longer delivers there, say so and offer pickup or similar venues that do.
- **Order for someone else:** another address plus recipient name and phone as the contact.

### 5.2 Finding food

- Restaurants and shops (supermarkets, pharmacies and others), with search inside a store's catalogue.
- Filters: open now, category or cuisine, rating, price level, delivery fee, delivery time, favourites only. Sort: fastest, cheapest delivery, best rated, nearest.
- Deals: current discounts, free-delivery offers and promotions; filter to only those.
- Compare a dish across venues: one search returns the dish from several venues with price, rating and delivery time side by side.
- Favourites: list, add, remove.

### 5.3 Dishes, pictures and language

- **Dish details:** everything Wolt has. Name, description, price and discount, picture, every option group and extra with prices and min/max rules, allergens, dietary tags, nutrition when listed, popularity marks, availability now.
- **Pictures are always sent.** List answers (menus, search, comparisons) include a small picture per dish plus its link. A single-dish answer includes the full-size picture.
- **At most 20 dishes per answer.** Each list answer states how many more exist ("20 of 104 shown") and returns a cursor; the agent fetches more only when the user asks.
- Small pictures are downscaled before sending so 20 of them stay light. Config `images: always | on-request | links` exists as a safety valve for clients that handle images badly; default `always`.
- **Language:** set once in setup. Text is shown in that language, flagged when machine-translated, with the original name kept beside it.
- **Food preferences:** allergies, diet and dislikes stored locally. They are included with every menu answer, and clashing dishes carry a warning. The MCP warns; it does not block.

### 5.4 Cart

- The cart is the same one the Wolt app uses. Before adding, the MCP shows what is already there. It never removes or changes items it did not add unless the user asks.
- **Required choices not given:** the dish is not added. `OPTIONS_REQUIRED` lists the missing groups with choices and prices. Nothing is guessed.
- Each venue has its own basket, as on Wolt.
- Age-restricted items (alcohol, tobacco) are allowed. Wolt's age step opens in the browser for the user; the MCP never answers it.

### 5.5 Checkout and payment

- Preview shows: items with options, address with details, delivery or pickup, time, fees, small-order surcharge, tip, discounts, credits, total, and payment method.
- Settable: delivery or pickup; now or scheduled; leave at the door; courier note; tip; promo code; Wolt credits and gift cards; note to the restaurant; cutlery; recipient for someone else.
- **Payment:** the Wolt-default method, shown in the preview (for example "Visa ••4821"). The user can switch to another saved method or cash. Card data never passes through the MCP.
- **Confirmation: a real click by the user, on every order.** Section 6.
- **Anything changed since the preview** (item sold out, any change in total): stop, show exactly what changed and a fix, and require a new preview and a new click. No tolerance band.
- **Spending limits:** optional, per order and per day, set by the user in setup or `wolt-mcp limits`. No tool can change them.

### 5.6 Orders

- **Tracking:** right after ordering, return status, expected time and Wolt's live-tracking link. After that, status on request, with courier name and position when Wolt shares them.
- **History:** search by venue, dish or date range; spending summaries ("this month").
- **Receipt:** full breakdown in chat (items, options, fees, tip, discounts, total, payment method, address, times). On request, save Wolt's receipt as a PDF to a folder the user names.
- **Reorder:** put a past order in the cart and report what is unavailable or changed in price.
- **Cancel:** only while Wolt allows it, after a real confirm click.
- **Problems:** open Wolt's support page for that order in the browser. The MCP does not talk to support.

### 5.7 Privacy

- Given to the agent: addresses (it needs them), order contents, masked phone, masked email, payment as type plus last four digits.
- Never given to the agent: session tokens, full phone, full email, door codes. Door codes appear only in the confirmation popup.
- No telemetry. Logs redact tokens, phone numbers and addresses.

## 6. Ordering safety

1. `wolt_place_order` only accepts a `preview_id` issued in the last 5 minutes, bound to the exact basket, address, payment method and total.
2. **Human confirmation outside the model.** The server shows the full summary to the user directly: MCP elicitation where the client supports it, otherwise a one-time page on `127.0.0.1` opened in the browser. The agent cannot answer for the user. No confirmation channel, or nobody present, means the order waits unpaid.
3. The same confirmation gates `wolt_cancel_order` and `wolt_delete_address`.
4. Spending limits (5.5) return `LIMIT_EXCEEDED`.
5. The place-order request is never retried. On a network failure the server checks order history before reporting the outcome.
6. Duplicate guard: the same basket ordered twice within 10 minutes is called out in the confirmation.
7. `readOnly: true` in config removes every write tool from the tool list.
8. Steps that need a person (age check, 3-D Secure, new-device check) open in the browser and return `USER_ACTION_REQUIRED`; the request resumes when they finish.
9. All venue and menu text is treated as untrusted third-party content and labelled so in the server instructions.

## 7. Tools

Prefix `wolt_`. Each declares MCP annotations (read-only, destructive, open-world) and an output schema.

| Tool | Purpose | Account |
|---|---|---|
| `wolt_set_location` | Set the browsing location: saved address, picked match, or coordinates | no |
| `wolt_search_address` | Address text → matches to pick from | no |
| `wolt_list_addresses` | Saved addresses with details | yes |
| `wolt_save_address` | Add or edit an address and its details | yes |
| `wolt_delete_address` | Delete a saved address (confirm click) | yes |
| `wolt_search` | Venues and dishes; filters; `compare` mode for one dish across venues | no |
| `wolt_list_venues` | Nearby restaurants or shops; filters, sort, deals, favourites | no |
| `wolt_get_venue` | Status, hours, fees, minimum, delivery methods, deals | no |
| `wolt_get_menu` | Category outline; or dishes by category or search, 20 per page with pictures | no |
| `wolt_get_item` | One dish in full, with full-size picture | no |
| `wolt_list_favourites` / `wolt_set_favourite` | Favourite venues | yes |
| `wolt_preferences` | Read or set local food preferences | no |
| `wolt_get_cart` | Current baskets | yes |
| `wolt_update_cart` | Add, change, remove, clear | yes |
| `wolt_reorder` | Fill the cart from a past order | yes |
| `wolt_checkout_preview` | Full summary with all settable extras; returns `preview_id` | yes |
| `wolt_place_order` | Order one `preview_id` (confirm click) | yes |
| `wolt_list_orders` | History, search, spending summaries | yes |
| `wolt_get_order` | Full details and receipt; optional PDF save | yes |
| `wolt_track_order` | Live status and tracking link | yes |
| `wolt_cancel_order` | Cancel while allowed (confirm click) | yes |
| `wolt_order_help` | Open Wolt support for an order | yes |
| `wolt_account` | Login state, masked profile, payment method labels | yes |

### AX rules

- Compact output shaped for the agent, never raw Wolt JSON. Every list is paginated with a cursor and a "shown X of Y" count.
- Prices as minor units and as formatted text with currency.
- IDs returned by one tool are accepted as-is by the next.
- Every error has a stable code, a one-sentence cause and the next step.
- Tool descriptions state when to use the tool, what it needs first, and what it returns.

## 8. Error codes

`NOT_FOUND`, `INVALID_INPUT`, `INTERNAL`, `LOGIN_REQUIRED`, `SESSION_EXPIRED`, `LOCATION_REQUIRED`, `ADDRESS_AMBIGUOUS`, `VENUE_CLOSED` (with next opening and scheduling option), `OUT_OF_RANGE` (with pickup and alternatives), `ITEM_UNAVAILABLE`, `OPTIONS_REQUIRED`, `BELOW_MINIMUM` (shows the surcharge), `PRICE_CHANGED`, `LIMIT_EXCEEDED`, `USER_ACTION_REQUIRED`, `CONFIRMATION_DECLINED`, `CONFIRMATION_UNAVAILABLE`, `CANCEL_NOT_ALLOWED`, `RATE_LIMITED`, `WOLT_API_CHANGED`, `NETWORK`.

## 9. Architecture

TypeScript, strict mode, official `@modelcontextprotocol/sdk`, `zod` for every Wolt response and every tool input.

```
src/
  api/        http.ts (one client: base URLs, headers, auth, retry, rate limit, error mapping)
              endpoints/*.ts (one typed function per Wolt call + its schema)
  auth/       session.ts (get, refresh, lock)  store.ts (keychain)
              sources/ browserCookies.ts  browserLogin.ts  loginWindow.ts  manual.ts
  domain/     location.ts  addresses.ts  discovery.ts  menu.ts  cart.ts
              checkout.ts  orders.ts  preferences.ts
  media/      images.ts (fetch, downscale, cache)
  format/     one formatter per output shape; privacy masking lives here
  tools/      one file per tool: { name, description, input, output, annotations, handler }
              registry.ts (registers all; wraps login on demand, error mapping, read-only filter)
  safety/     previewStore.ts  confirm.ts  limits.ts
  platform/   paths, browser discovery, opening URLs (the only OS-specific code)
  cli/        setup.ts  login.ts  logout.ts  status.ts  doctor.ts  limits.ts
  config.ts   errors.ts   server.ts
```

Rules:

- A tool file contains no HTTP, auth, masking or formatting code; it composes `domain` and `format`.
- Cross-cutting behaviour (login on demand, retries, error mapping, redaction, pagination) exists in exactly one place.
- OS differences live only in `platform/` and `auth/sources/`.
- Retries with backoff only for read-only calls, on 429 and 5xx.
- Schemas tolerate unknown fields and are strict on fields the code uses; a mismatch raises `WOLT_API_CHANGED` naming the endpoint.
- Comments only where the reason is not obvious from the code. No duplicated logic.
- stdout carries only MCP traffic.

## 10. Testing

- Unit tests (vitest) for domain logic, formatters and masking, pagination, preview binding, limits, session refresh and locking.
- Tool tests against recorded Wolt responses with personal data scrubbed.
- CI runs lint, types and tests on macOS, Windows and Linux.
- `npm run live-check`: calls every read-only endpoint and validates schemas. Runs daily in CI and inside `doctor`.
- Login and keychain flows are tested by hand on each OS before release (macOS here, Windows on the user's laptop, Linux in a VM).
- Real orders are placed only by the user, who confirms each one. No automated test ever places an order.

## 11. Phases

Each phase ends in something usable and gets its own implementation plan.

| Phase | Delivers | Endpoint status |
|---|---|---|
| 1. Browse | Skeleton, config, `setup`, `doctor`, location and address search, search, venues, deals, compare, shops, menus, dish details, pictures, food preferences, CI | Venues, search, venue status, menu ✅. Address search, deals filters, in-store search 📄 |
| 2. Account | Login on all three OSes, saved addresses, favourites, cart, reorder, checkout preview, orders, receipts, tracking, account | 📄. Starts with a logged-in recording to confirm request and response shapes |
| 3. Order | Place order, confirmation click, limits, duplicate guard, cancel, user-action hand-offs | Place-order and cancel calls ❓. Starts with one real checkout the user performs while it is recorded |
| 4. Release | Hand tests on three OSes, README, licence, security policy, changelog, publish to GitHub and npm | n/a |

## 12. Open-source basics

MIT licence, README with one-command install and the unofficial notice, CHANGELOG, SECURITY.md, CONTRIBUTING.md, automated npm publish with provenance, semantic versioning.

## 13. Risks

- Private API: Wolt can change or block it. Reduced by schemas, `doctor` and the daily live check; cannot be removed.
- Terms of service: automated use may breach them, and a public repo using the Wolt name is visible. Wolt may ask for a rename or takedown. The project stays low-rate, personal-use, and never bypasses bot protection.
- Reading browser cookie stores differs per OS and browser and can be refused. The fallback login window keeps login possible.
- Always sending pictures makes answers heavy; some clients may truncate. The 20-per-page cap, downscaling and the `images` setting contain this.
- Three OSes at launch roughly doubles login and testing work.
- Libraries for cookie reading, keychain and image downscaling are chosen in the phase plans after testing; this spec fixes behaviour, not libraries.
