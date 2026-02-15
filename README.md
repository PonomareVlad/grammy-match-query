# Runtime Filter Queries Plugin for grammY

A [grammY](https://grammy.dev/) plugin that interprets
[filter queries](https://grammy.dev/guide/filter-queries) at runtime, with
support for any property combination — including queries that grammY's static
type system would reject.

## Features

- **Full query syntax** — supports L1, L2, and L3 filter queries just like
  grammY's built-in `bot.on()`.
- **L1 shortcuts** — `""` and `msg` expand to `message` + `channel_post`;
  `edit` expands to `edited_message` + `edited_channel_post`.
- **L2 shortcuts** — `""` expands to `entities` + `caption_entities`; `media`
  expands to `photo` + `video`; `file` expands to all file types.
- **Unrestricted queries** — no static validation, so any property path works
  at runtime (e.g. `:media:media_group_id`).
- **Multiple queries** — pass an array of queries for OR logic.
- **Compatible** — returns a predicate for `bot.filter()`.

## Installation

### Node.js

```bash
npm install github:PonomareVlad/grammy-runtime-queries
```

### Deno

```typescript
import { runtimeQuery } from "https://raw.githubusercontent.com/PonomareVlad/grammy-runtime-queries/main/src/mod.ts";
```

## Usage

```typescript
import { Bot } from "grammy";
import { runtimeQuery } from "grammy-runtime-queries";

const bot = new Bot("<your-bot-token>");

// Filter by an unsupported query — media with media_group_id
bot.filter(runtimeQuery(":media:media_group_id"), (ctx) => {
    console.log("Media group received");
});

// Standard queries work too
bot.filter(runtimeQuery("message:entities:url"), (ctx) => {
    console.log("Message with URL entity");
});

// Multiple queries (OR logic)
bot.filter(runtimeQuery([":photo", ":video"]), (ctx) => {
    console.log("Photo or video");
});

// L1 shortcuts
bot.filter(runtimeQuery("edit:text"), (ctx) => {
    console.log("Edited text message or channel post");
});

// L2 shortcuts
bot.filter(runtimeQuery("message:file"), (ctx) => {
    console.log("Message with any file type");
});

bot.start();
```

## Query Syntax

Queries use the same colon-separated format as grammY's
[filter queries](https://grammy.dev/guide/filter-queries):

| Query                   | Description                              |
| ----------------------- | ---------------------------------------- |
| `message`               | Any message update                       |
| `message:photo`         | Message with a photo                     |
| `message:entities:url`  | Message with a URL entity                |
| `:photo`                | Photo in message or channel post         |
| `msg:photo`             | Same as above                            |
| `edit:text`             | Edited text message or channel post      |
| `message:media`         | Message with photo or video              |
| `message:file`          | Message with any file type               |
| `message::url`          | URL in entities or caption_entities      |
| `:media:media_group_id` | Media with media_group_id (runtime-only) |

## How It Works

1. **Parse** — the query string is split by `:` into up to three levels.
2. **Expand** — L1 and L2 shortcuts are expanded into all concrete paths.
3. **Compile** — each path becomes a predicate checking property existence on
   the update object. L3 checks both property names and `type` fields.
4. **Compose** — multiple predicates are combined with OR logic.

The key difference from grammY's built-in `matchFilter` is that this plugin
does not validate queries against a static set of known keys, allowing any
property path to be checked at runtime.
