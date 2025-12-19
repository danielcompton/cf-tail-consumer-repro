# multiplayer-js

Minimal Cloudflare Workers Durable Object WebSocket reproduction case for debugging a performance regression between Wrangler 4.31.0 and 4.32.0. From bisecting between these two tags, it looks like this was introduced in [d3040550](https://github.com/cloudflare/workers-sdk/commit/d3040550adaad031f24327fbfbe9fecdeface0b5).

https://github.com/user-attachments/assets/339eae5e-2216-4f7b-b607-2f2b3274826e

## Fixing it

If you remove `tail_consumers` with the nonexistent `missing-consumer-xyz` from the `wrangler.toml`, the issue disappears.

## What it does

- Durable Object accepts WebSocket connections
- Broadcasts JSON messages to all connected clients
- Debug page at `/` shows cursor positions from all connected browsers

## Setup

```bash
npm install
```

## Running

```bash
# Run with wrangler 4.32.0 (bad)
npm run dev-bad

# Run with wrangler 4.31.0 (good)
npm run dev-good
```

Then open http://localhost:8787 in multiple browser windows and move your cursor.

## Files

- `src/index.js` - Worker and Durable Object code
- `wrangler.toml` - Cloudflare Workers configuration
