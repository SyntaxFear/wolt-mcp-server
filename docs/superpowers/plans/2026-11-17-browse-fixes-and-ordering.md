# Browse fixes, cards and ordering — decisions (2026-11-17)

Agreed with the user in a question-by-question interview after a real browsing session. The design spec
(`../specs/2026-11-16-wolt-mcp-design.md`) still holds; where the two differ, this file wins.

| Area | Decision |
|---|---|
| Photos | Menu cards drawn in chat (MCP Apps). Clients without card support get one combined picture file. |
| Card taps | Open the venue or dish in Wolt. |
| Address | Paste a map link; named saved places (Home, Office). |
| Language | Menus default to the venue's own language; interface language is a separate setting. |
| Closed venues | Open ones first, then a count and the next opening times. |
| Menus | Whole menu in one answer up to 40 dishes. |
| Small fixes | Real distance in metres; delivery fee and minimum order in venue lists. |
| Login | User signs in on Wolt's own page; session in the OS keychain. |
| Ordering | Preview with total, then the user's confirmation; saved card or cash. |
| After ordering | Tracking, history, reorder. No cancel in this round. |
| Testing | Recorded data only, stop at the preview. The user places the first real order. |
| Delivery | One branch, private GitHub repo. Public repo and npm only when the user says so. |

## Findings behind the fixes

- `sorting.sortables[].value` in venue cards is a rank, not a measurement. Distance is computed from `venue.location`.
- Venue cards carry no fee or minimum. Both are in the venue `dynamic` page under
  `header.delivery_method_statuses[].metadata` (`DELIVERY_FEE`, `ORDER_MINIMUM`), with `next_open` beside them.
- `https://wolt.com/{lang}/{country}/venue/{slug}` redirects to the venue page; `{share_url}/itemid-{id}` to a dish.
- The chat view of Claude desktop blocks remote images, so pictures must travel inside the tool result.

## Blocked until the user is logged in

Cart, checkout preview, payment methods, order history and tracking are known from Wolt's site code only. Their
request and response shapes are confirmed against a logged-in session before any of them is written. The
place-order call is still unknown and is recorded from one checkout the user performs themself.
