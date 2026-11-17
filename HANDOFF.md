# Handoff — where this project stands

Read this first when picking the project up again. Last updated 2026-11-17.

## What it is

`wolt-mcp-server`: an unofficial MCP server that lets an AI agent browse Wolt (venues, menus, dishes, pictures)
for a delivery location. Not affiliated with Wolt. It uses Wolt's private web API, so any endpoint can change
without notice. MIT licence. Not published to npm yet (the name `wolt-mcp` is taken; `wolt-mcp-server` was free).

## Read next, in this order

1. `docs/superpowers/plans/2026-11-17-browse-fixes-and-ordering.md`: the latest decisions and what is blocked.
   Where it differs from the spec, it wins.
2. `docs/superpowers/specs/2026-11-16-wolt-mcp-design.md`: the full design (spec v2).
3. `RESEARCH.md` and `research/`: how Wolt's API was mapped. `research/raw/` holds real responses;
   `research/endpoint-paths.txt` lists every path found in the site code.

## Run it

```bash
npm install
npm run build          # dist/ is what MCP clients run
npm test               # vitest, 124 tests at handoff
npm run check          # biome lint + format
node dist/cli/index.js setup    # pick language, register with Claude Code / other clients
node dist/cli/index.js doctor   # live check against Wolt
node dist/cli/index.js login    # opens Wolt's login page in a separate browser profile
node dist/cli/index.js status   # is a session stored and does it refresh
node dist/cli/index.js logout
```

With no command, `serve` runs the MCP server over stdio. After `npm run build`, the client needs a new session
to see changed tools.

## Status

Done and checked against live Wolt:

- Tools: `wolt_search_address`, `wolt_set_location`, `wolt_list_venues`, `wolt_search`, `wolt_get_venue`,
  `wolt_get_menu`, `wolt_get_item`, `wolt_preferences`.
- Real distance, delivery fee, minimum order, open/closed status, next opening, a closed-venue summary.
- Whole menu in one answer up to 40 dishes; menus in the venue's own language by default (`menuLanguage`).
- Map links (Google, Apple, OpenStreetMap, short links followed safely) and named saved places.
- Wolt links on venues and dishes.
- Pictures: card view in chat through MCP Apps (`ui://wolt/cards.html`), and a combined JPEG
  (`picture_sheet`) for clients without cards.

Built but not yet proven end to end:

- Cards were checked in a browser with a stand-in host, never inside Claude desktop itself.
- Login (`src/auth/`) has been dry-run only. Nobody has logged in through it yet.

Not built:

- Cart, checkout preview, payment methods, order history, reorder, tracking. These endpoints answer 401 without
  a login, so they exist, but their request/response shapes are only known from site code.
- Placing an order. The call is unknown.

## Next steps

1. Run `login`, sign in for real. This confirms the `__wrtoken` cookie format and the refresh response fields
   (`src/auth/session.ts`). Fix whatever differs.
2. With that session, record real requests/responses for baskets, checkout preview, payment methods, orders
   and tracking into `research/raw/`, then build cart → preview → history → reorder → tracking.
3. Placing an order needs one real checkout done by a person in the login window, recorded. Until then the tools
   stop at the preview.
4. Check the cards inside Claude desktop.
5. Publish to npm when testing is done.

## Rules the owner set (keep them)

- Every order shows a summary with the total and waits for the user's yes; the spec asks for a real click
  outside the model.
- Payment: a saved card or cash only. Card data never passes through this server.
- No cancel in this round. Never bypass a captcha. Never read sessions from the user's everyday browser.
- Testing never places a real order.
- Clean code, few comments.

## Code map

| Path | What |
|---|---|
| `src/api/` | HTTP client, response validation (zod), one module per Wolt endpoint group |
| `src/domain/` | Pure logic: venues, menu, money, distance, links, map links, live info, preferences |
| `src/tools/` | One file per MCP tool; `registry.ts` registers them and the card resource |
| `src/ui/cards.ts` | The self-contained card page (MCP Apps), `textContent` only, opens only `https://wolt.com/` links |
| `src/media/` | Fetching pictures as base64; `sheet.ts` draws the combined JPEG with sharp |
| `src/auth/` | Login window over DevTools, keychain store, session refresh |
| `src/cli/` | `serve`, `setup`, `doctor`, `login`, `logout`, `status` |
| `src/server.ts` | Server instructions and the card-support check |
| `tests/` | vitest; `tests/fixtures/` are recorded Wolt responses |

## Wolt API facts that cost time to learn

- Main host `consumer-api.wolt.com`. Session refresh: `POST authentication.wolt.com/v1/wauth2/access_token`,
  form-urlencoded, `grant_type=refresh_token` (JSON and multipart get 415; a bad token gets 401, error_code 126).
- `sorting.sortables[].value` in venue cards is a rank, not a measurement. Lower rating rank = better rating.
- Venue cards carry no fee or minimum. Both are on the venue `dynamic` page under
  `header.delivery_method_statuses[].metadata` (`DELIVERY_FEE`, `ORDER_MINIMUM`), plus `delivery_open_status.next_open`.
- `https://wolt.com/{lang}/{country}/venue/{slug}` redirects to a venue. A dish link needs the city:
  `/{country}/{city}/venue/{slug}/itemid-{id}`, or `share_url` + `/itemid-{id}`.
- Claude desktop's chat view blocks remote images, so pictures must travel inside the tool result.
- MCP Apps: resource mime `text/html;profile=mcp-app`; tool `_meta` carries `ui.resourceUri` and
  `ui/resourceUri`; client support is read from capability `extensions["io.modelcontextprotocol/ui"]`.
  The `@modelcontextprotocol/ext-apps` package needed SDK v2, so the messages are hand-written.
- Login window: Chrome/Brave/Edge/Chromium with its own `--user-data-dir` and `--remote-debugging-port=0`;
  `Storage.getCookies` is polled for `__wrtoken`. Close with `Browser.close` before killing, or helpers linger.

## Repository

- GitHub: `SyntaxFear/wolt-mcp-server`. The GitHub Actions workflows in `.github/workflows/` (CI and a daily
  live check) are switched off in the repo settings; turn them on when billing allows.
