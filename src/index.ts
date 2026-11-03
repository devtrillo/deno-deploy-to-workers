import { encodeBase64Url } from "@std/encoding/base64url";

function randomSlug() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(4)));
}

async function createLink(req: Request, env: Env) {
  const { url, slug = randomSlug() } = await req.json<{ url: string; slug?: string }>();
  if (!URL.canParse(url)) return Response.json({ error: "bad url" }, { status: 400 });

  // Workers KV has no atomic check. This is a read, then a write, with a gap.
  if (await env.LINKS.get(`links:${slug}`)) {
    return Response.json({ error: "slug taken" }, { status: 409 });
  }
  await env.LINKS.put(`links:${slug}`, url);

  return Response.json({ slug, url }, { status: 201 });
}

async function follow(slug: string, env: Env) {
  const url = await env.LINKS.get(`links:${slug}`);
  if (!url) return new Response("not found", { status: 404 });

  // No sum() either: read, add one, write back.
  const hits = Number(await env.LINKS.get(`hits:${slug}`) ?? 0);
  await env.LINKS.put(`hits:${slug}`, String(hits + 1));
  return Response.redirect(url, 302);
}

async function stats(slug: string, env: Env) {
  const [url, hits] = await Promise.all([
    env.LINKS.get(`links:${slug}`),
    env.LINKS.get(`hits:${slug}`),
  ]);
  if (!url) return new Response("not found", { status: 404 });

  return Response.json({ slug, url, hits: Number(hits ?? 0) });
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
