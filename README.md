# Deno Deploy to Workers

The code for the devtrillo.com post on moving a Deno Deploy app to Cloudflare Workers before Deploy shuts down ([blog issue](https://github.com/devtrillo/blog/issues/565)).

A tiny URL shortener: `POST /links` claims a slug, `GET /:slug` redirects and counts a click, `GET /:slug/stats` shows the count.

- `deno` tag: the Deno Deploy version, `Deno.serve` + Deno KV, where the post starts.
- `workers` tag: the same app on Cloudflare Workers, one SQLite-backed Durable Object per slug.

## What changed

Every change is in one PR: [#1 Port the shortener to Cloudflare Workers](https://github.com/devtrillo/deno-deploy-to-workers/pull/1). It has two commits on purpose:

1. A straight port with Workers KV in place of Deno KV. It typechecks, it runs, and it loses clicks.
2. Workers KV replaced with a Durable Object per slug. Nothing lost.

| Deno Deploy                                     | Cloudflare Workers                                              |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `Deno.serve(handler)`                           | `export default { fetch(req, env) }`                            |
| `await Deno.openKv()`, a global                 | `env.LINK.getByName(slug)`, a binding                           |
| `kv.atomic().check({ versionstamp: null }).set` | a `create()` method on the Durable Object, sync storage          |
| `kv.atomic().sum(key, 1n)`                      | read and write `ctx.storage.kv` inside the object               |
| `jsr:@std/encoding` in `deno.json` imports      | `npx jsr add @std/encoding`, the same package from npm           |
| `deno task dev`                                 | `wrangler dev`                                                  |

## Run it

```sh
bun install
bun run dev     # wrangler dev on :8787
bun run race    # 20 concurrent claims on one slug, then 50 concurrent clicks
bun run deploy  # needs a Cloudflare account
```

`race.ts` exits non-zero unless exactly 1 claim wins and all 50 clicks count. On the Workers KV commit it prints something like `clicks: 4 of 50 counted`.

`git checkout deno` for the original (`deno task dev`, then `deno task race`).
