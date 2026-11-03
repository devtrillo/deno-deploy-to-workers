import { encodeBase64Url } from "@std/encoding/base64url";

const kv = await Deno.openKv();

function randomSlug() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(4)));
}

async function createLink(req: Request) {
  const { url, slug = randomSlug() } = await req.json();
  if (!URL.canParse(url)) return Response.json({ error: "bad url" }, { status: 400 });

  // Only write if nobody owns this slug yet. Two requests racing for the
  // same slug: one commits, the other gets ok: false.
  const res = await kv.atomic()
    .check({ key: ["links", slug], versionstamp: null })
    .set(["links", slug], url)
    .commit();
  if (!res.ok) return Response.json({ error: "slug taken" }, { status: 409 });

  return Response.json({ slug, url }, { status: 201 });
}

async function follow(slug: string) {
  const link = await kv.get<string>(["links", slug]);
  if (!link.value) return new Response("not found", { status: 404 });

  await kv.atomic().sum(["hits", slug], 1n).commit();
  return Response.redirect(link.value, 302);
}

async function stats(slug: string) {
  const [link, hits] = await kv.getMany<[string, Deno.KvU64]>([["links", slug], ["hits", slug]]);
  if (!link.value) return new Response("not found", { status: 404 });

  return Response.json({ slug, url: link.value, hits: Number(hits.value?.value ?? 0n) });
}

export function handler(req: Request) {
  const { pathname } = new URL(req.url);
  const [slug, sub] = pathname.slice(1).split("/");

  if (req.method === "POST" && pathname === "/links") return createLink(req);
  if (req.method === "GET" && slug && sub === "stats") return stats(slug);
  if (req.method === "GET" && slug && !sub) return follow(slug);
  return new Response("not found", { status: 404 });
}

if (import.meta.main) Deno.serve(handler);
