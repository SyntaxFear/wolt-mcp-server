import { VERSION } from "../version.js";

export const CARDS_URI = "ui://wolt/cards.html";
export const CARDS_MIME_TYPE = "text/html;profile=mcp-app";
export const UI_EXTENSION = "io.modelcontextprotocol/ui";

/** Hosts the cards may load pictures from when a result carries links instead of picture data. */
export const PICTURE_HOSTS = ["https://imageproxy.wolt.com", "https://wolt-menu-images-cdn.wolt.com"];

/** Marks a tool whose result the cards can draw. Both keys are sent: older hosts read the flat one. */
export const CARDS_META = { ui: { resourceUri: CARDS_URI }, "ui/resourceUri": CARDS_URI };

/**
 * The card view shown in the chat by apps that support MCP Apps. One self-contained page: it speaks the
 * MCP Apps messages itself, so nothing is loaded from the network except pictures from PICTURE_HOSTS.
 * Every piece of Wolt text is placed with textContent, never as markup.
 */
export const CARDS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wolt</title>
<style>
:root{--bg:transparent;--card:#fff;--ink:#1f1d1a;--mute:#6f6a62;--line:#e6e1d8;--accent:#b4501f;--tag:#f3e4da;--blank:#eeeae2}
:root[data-theme=dark]{--card:#262421;--ink:#f1eee8;--mute:#a39d93;--line:#3a3733;--accent:#f0935f;--tag:#4a2f20;--blank:#33302c}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--card:#262421;--ink:#f1eee8;--mute:#a39d93;--line:#3a3733;--accent:#f0935f;--tag:#4a2f20;--blank:#33302c}}
*{box-sizing:border-box}
body{margin:0;padding:4px 2px 8px;background:var(--bg);color:var(--ink);font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
h1{font-size:17px;font-weight:600;margin:0 0 2px}
.sub{color:var(--mute);font-size:13px;margin:0 0 10px}
h2{font-size:14px;font-weight:600;margin:14px 0 8px;color:var(--mute)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.card{display:flex;flex-direction:column;justify-content:flex-start;width:100%;height:100%;padding:0;text-align:left;font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
button.card{cursor:pointer}
button.card:hover,button.card:focus-visible{border-color:var(--accent);outline:none}
.pic{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:var(--blank)}
.body{padding:8px 10px 10px}
.name{font-weight:600;overflow-wrap:anywhere}
.line{color:var(--mute);font-size:12.5px;margin-top:2px;overflow-wrap:anywhere}
.price{color:var(--accent);font-weight:600;margin-top:4px}
.was{color:var(--mute);font-weight:400;text-decoration:line-through;margin-left:6px}
.tag{display:inline-block;font-size:11px;background:var(--tag);color:var(--accent);border-radius:6px;padding:1px 6px;margin:4px 4px 0 0}
.off{opacity:.55}
.note{color:var(--mute);font-size:13px;margin:12px 0 0}
</style>
</head>
<body>
<div id="root"><p class="note">Loading…</p></div>
<script>
(function () {
  "use strict";
  var PICTURE_HOSTS = ${JSON.stringify(PICTURE_HOSTS)};
  var root = document.getElementById("root");
  var nextId = 1;
  var waiting = {};

  function post(message) { window.parent.postMessage(message, "*"); }
  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    return new Promise(function (resolve) { waiting[id] = resolve; });
  }
  function notify(method, params) { post({ jsonrpc: "2.0", method: method, params: params || {} }); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function woltLink(url) {
    return typeof url === "string" && url.indexOf("https://wolt.com/") === 0 ? url : null;
  }
  function pictureSource(item, pictures) {
    var attached = typeof item.picture === "number" ? pictures[item.picture - 1] : null;
    if (attached) return "data:" + attached.mimeType + ";base64," + attached.data;
    var url = item.image;
    if (typeof url !== "string") return null;
    for (var i = 0; i < PICTURE_HOSTS.length; i++) {
      if (url.indexOf(PICTURE_HOSTS[i] + "/") === 0) return url + (url.indexOf("?") < 0 ? "?w=400" : "");
    }
    return null;
  }
  function card(item, pictures, lines, tags) {
    var url = woltLink(item.url);
    var node = el(url ? "button" : "div", "card");
    if (url) {
      node.type = "button";
      node.title = "Open in Wolt";
      node.addEventListener("click", function () { request("ui/open-link", { url: url }); });
    }
    var source = pictureSource(item, pictures);
    if (source) {
      var picture = el("img", "pic");
      picture.alt = "";
      picture.loading = "lazy";
      picture.addEventListener("error", function () { picture.remove(); });
      picture.src = source;
      node.appendChild(picture);
    }
    var body = el("div", "body");
    body.appendChild(el("div", "name", item.name));
    lines.forEach(function (line) { if (line) body.appendChild(el("div", "line", line)); });
    if (item.price && item.price.text) {
      var price = el("div", "price", item.price.text);
      if (item.original_price && item.original_price.text) price.appendChild(el("span", "was", item.original_price.text));
      body.appendChild(price);
    }
    tags.forEach(function (tag) { if (tag) body.appendChild(el("span", "tag", tag)); });
    node.appendChild(body);
    return node;
  }
  function dishCard(dish, pictures) {
    var node = card(
      dish,
      pictures,
      [dish.venue_name, dish.available === false ? dish.unavailable_reason || "Not available now" : null],
      (dish.tags || []).slice(0, 2).concat(dish.warnings || []),
    );
    if (dish.available === false) node.classList.add("off");
    return node;
  }
  function venueCard(venue, pictures) {
    var facts = [];
    if (typeof venue.rating === "number") facts.push("★ " + venue.rating);
    if (venue.delivery_minutes) facts.push(venue.delivery_minutes + " min");
    if (typeof venue.distance_m === "number") {
      facts.push(venue.distance_m < 1000 ? venue.distance_m + " m" : (venue.distance_m / 1000).toFixed(1) + " km");
    }
    var money = [];
    if (venue.delivery_fee) money.push("Delivery " + venue.delivery_fee);
    if (venue.order_minimum) money.push(venue.order_minimum);
    var node = card(
      venue,
      pictures,
      [venue.description, facts.join(" · "), money.join(" · "), venue.status || (venue.open ? null : "Closed")],
      (venue.promotions || []).slice(0, 2),
    );
    if (venue.open === false) node.classList.add("off");
    return node;
  }
  function grid(nodes) {
    var wrap = el("div", "grid");
    nodes.forEach(function (node) { wrap.appendChild(node); });
    return wrap;
  }
  function render(result) {
    var data = (result && result.structuredContent) || {};
    var pictures = ((result && result.content) || []).filter(function (block) { return block.type === "image"; });
    root.textContent = "";
    if (data.venue && data.venue.name) root.appendChild(el("h1", null, data.venue.name));
    var dishes = data.dish ? [data.dish] : data.dishes;
    if (dishes && dishes.length) {
      var sections = [];
      dishes.forEach(function (dish) {
        var title = dish.category || "";
        var last = sections[sections.length - 1];
        if (!last || last.title !== title) sections.push((last = { title: title, dishes: [] }));
        last.dishes.push(dish);
      });
      sections.forEach(function (section) {
        if (section.title) root.appendChild(el("h2", null, section.title));
        root.appendChild(grid(section.dishes.map(function (dish) { return dishCard(dish, pictures); })));
      });
    } else if (data.venues && data.venues.length) {
      root.appendChild(grid(data.venues.map(function (venue) { return venueCard(venue, pictures); })));
    } else if (data.categories && data.categories.length) {
      root.appendChild(grid(data.categories.map(function (category) {
        return card({ name: category.name }, [], [typeof category.dishes === "number" ? category.dishes + " dishes" : null], []);
      })));
    } else {
      root.appendChild(el("p", "note", result && result.isError ? "Wolt could not answer this one." : "Nothing to show."));
    }
    if (data.shown && data.next_cursor) root.appendChild(el("p", "note", "Showing " + data.shown + ". Ask for more to see the rest."));
    if (data.closed && data.closed.count) root.appendChild(el("p", "note", data.closed.count + " more closed right now."));
    reportSize();
  }
  function applyContext(context) {
    if (context && (context.theme === "dark" || context.theme === "light")) {
      document.documentElement.setAttribute("data-theme", context.theme);
    }
  }
  function reportSize() {
    notify("ui/notifications/size-changed", {
      width: Math.ceil(document.documentElement.scrollWidth),
      height: Math.ceil(document.documentElement.scrollHeight),
    });
  }

  window.addEventListener("message", function (event) {
    var message = event.data;
    if (event.source !== window.parent || !message || message.jsonrpc !== "2.0") return;
    if (message.id !== undefined && message.method === undefined) {
      var done = waiting[message.id];
      delete waiting[message.id];
      if (done) done(message.result);
      return;
    }
    if (message.method === "ui/notifications/tool-result") render(message.params);
    else if (message.method === "ui/notifications/host-context-changed") applyContext(message.params);
    else if (message.id !== undefined) post({ jsonrpc: "2.0", id: message.id, result: {} });
  });
  if (window.ResizeObserver) new ResizeObserver(reportSize).observe(document.documentElement);

  request("ui/initialize", {
    appInfo: { name: "wolt-mcp-server", version: ${JSON.stringify(VERSION)} },
    appCapabilities: {},
    protocolVersion: "2026-01-26",
  }).then(function (result) {
    applyContext(result && result.hostContext);
    notify("ui/notifications/initialized");
  });
})();
</script>
</body>
</html>
`;
