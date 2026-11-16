# wolt-mcp-server

Unofficial MCP server for Wolt. Lets an AI agent (Claude Code, Codex, Cursor, Claude Desktop) find venues and dishes near you and read menus with pictures.

> Not affiliated with, endorsed by, or supported by Wolt. It uses Wolt's private web API, which can change or stop working at any time. For personal use, at human request rates.

## Status

Browsing works and needs no login. Cart, checkout and ordering are in development.

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
| `wolt_set_location` | Set where food is delivered |
| `wolt_list_venues` | Nearby restaurants or shops, with filters and sorting |
| `wolt_search` | Find a venue, or compare one dish across venues |
| `wolt_get_venue` | Open hours, delivery time, minimum order |
| `wolt_get_menu` | Menu categories and dishes, 20 per page, with pictures |
| `wolt_get_item` | One dish in full: options, extras, large picture |
| `wolt_preferences` | Allergies, diets and dislikes, kept on your computer |

## Settings

`~/.config/wolt-mcp/config.json` (Windows: `%APPDATA%\wolt-mcp\config.json`)

| Key | Values | Default |
|---|---|---|
| `language` | `en`, `ka`, `ru`, ... | `en` |
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
