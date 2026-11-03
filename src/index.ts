import { DurableObject } from "cloudflare:workers";
import { encodeBase64Url } from "@std/encoding/base64url";

// One Link object per slug. Calls into it run one at a time, and the storage
// API is synchronous, so check-then-set has no gap for another request.
export class Link extends DurableObject {
  create(url: string) {
    if (this.ctx.storage.kv.get("url")) return false;
    this.ctx.storage.kv.put("url", url);
    return true;
  }

  hit() {
    const url = this.ctx.storage.kv.get<string>("url");
    if (url) this.ctx.storage.kv.put("hits", (this.ctx.storage.kv.get<number>("hits") ?? 0) + 1);
    return url;
  }

  stats() {
    const url = this.ctx.storage.kv.get<string>("url");
    return url ? { url, hits: this.ctx.storage.kv.get<number>("hits") ?? 0 } : undefined;
  }
}

function randomSlug() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(4)));
}

async function createLink(req: Request, env: Env) {
  const { url, slug = randomSlug() } = await req.json<{ url: string; slug?: string }>();
  if (!URL.canParse(url)) return Response.json({ error: "bad url" }, { status: 400 });

  if (!(await env.LINK.getByName(slug).create(url))) {
    return Response.json({ error: "slug taken" }, { status: 409 });
  }
  return Response.json({ slug, url }, { status: 201 });
}

async function follow(slug: string, env: Env) {
  const url = await env.LINK.getByName(slug).hit();
  if (!url) return new Response("not found", { status: 404 });

  return Response.redirect(url, 302);
}

async function stats(slug: string, env: Env) {
  const link = await env.LINK.getByName(slug).stats();
  if (!link) return new Response("not found", { status: 404 });

  return Response.json({ slug, ...link });
}

export default {
  fetch(req, env) {
    const { pathname } = new URL(req.url);
    const [slug, sub] = pathname.slice(1).split("/");

    if (req.method === "POST" && pathname === "/links") return createLink(req, env);
    if (req.method === "GET" && slug && sub === "stats") return stats(slug, env);
    if (req.method === "GET" && slug && !sub) return follow(slug, env);
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
