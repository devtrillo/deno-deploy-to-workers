import { assertEquals } from "@std/assert";
import { handler } from "./main.ts";

const post = (body: unknown) =>
  handler(new Request("http://x/links", { method: "POST", body: JSON.stringify(body) }));
const get = (path: string) => handler(new Request(`http://x${path}`));

Deno.test("create, follow, count", async () => {
  const slug = `t-${crypto.randomUUID()}`;
  assertEquals((await post({ slug, url: "https://deno.com" })).status, 201);
  assertEquals((await post({ slug, url: "https://example.com" })).status, 409);

  const hit = await get(`/${slug}`);
  assertEquals(hit.headers.get("location"), "https://deno.com/");
  await get(`/${slug}`);

  assertEquals(await (await get(`/${slug}/stats`)).json(), { slug, url: "https://deno.com", hits: 2 });
});
