# wolt-mcp-server

Unofficial MCP server for Wolt. Lets an AI agent (Claude Code, Codex, Cursor, Claude Desktop) find venues and dishes near you and read menus with pictures.

> Not affiliated with, endorsed by, or supported by Wolt. It uses Wolt's private web API, which can change or stop working at any time. For personal use, at human request rates.

## Status

Browsing works and needs no login. Every venue and dish comes with a link that opens it in Wolt, where you order. Cart, checkout and ordering from the agent are in development.

## Install

```bash
npx wolt-mcp-server setup
```

Setup adds the server to the apps it finds and asks for your menu language. Restart the app, then ask it something like "What can I order on Wolt near Rustaveli 12, Tbilisi?".

Check that everything works:

```bash
npx wolt-mcp-server doctor
```

## Tools

| Tool | What it does |
|---|---|
| `wolt_search_address` | Find addresses matching what you typed |
| `wolt_set_location` | Set where food is delivered: a pasted map link, a saved place such as Home, a picked address, or coordinates |
| `wolt_list_venues` | Nearby restaurants or shops with distance, delivery fee, minimum order, filters and sorting; says how many are closed and which open next |
| `wolt_search` | Find a venue, or compare one dish across venues |
| `wolt_get_venue` | Open hours, delivery time, minimum order |
| `wolt_get_menu` | A small menu whole; a large one by category or search, 20 dishes per page. With pictures |
| `wolt_get_item` | One dish in full: options, extras, large picture |
| `wolt_preferences` | Allergies, diets and dislikes, kept on your computer |

## Login (early)

```bash
npx wolt-mcp-server login
```

Opens Wolt's own login page in a separate browser window with an empty profile. You log in there yourself; the tool never sees your phone code or email link, and never reads your everyday browser. The session is kept in the macOS Keychain or the Linux system keyring (a user-only file where neither exists). `status` shows whether it works, `logout` removes it. Nothing uses the login yet: cart and ordering come next.

## Pictures

Apps that support MCP Apps draw venue and dish cards in the chat; a tap opens the venue or dish in Wolt. Other apps get `picture_sheet` in the answer: the path of one image file with every picture, name and price, which the agent can show you.

## Settings

`~/.config/wolt-mcp/config.json` (Windows: `%APPDATA%\wolt-mcp\config.json`)

| Key | Values | Default |
|---|---|---|
| `language` | `en`, `ka`, `ru`, ... Language of venue lists and of Wolt's own wording | `en` |
| `menuLanguage` | `original` (the venue's own language) or `interface` (your `language`, machine-translated by Wolt when the venue has no such menu) | `original` |
| `places` | Saved places, written by `wolt_set_location` | none |
| `images` | `always`, `on-request`, `links` | `always` |

## Privacy

Everything runs on your computer. No telemetry. Your location and food preferences are stored only in the config file above.

## Development

```bash
npm install
npm test
npm run doctor
```

## License

MIT
