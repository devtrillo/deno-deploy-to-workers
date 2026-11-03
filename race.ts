// Two races against a running server. The right answers are "1 of 20" and
// "50 of 50".
const base = process.argv[2] ?? "http://localhost:8000";
const slug = `race-${Date.now()}`;
const times = <T>(n: number, fn: (i: number) => Promise<T>) =>
  Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

// 20 requests claim the same slug at once. One should win.
const statuses = await times(20, (i) =>
  fetch(`${base}/links`, {
    method: "POST",
    body: JSON.stringify({ slug, url: `https://example.com/${i}` }),
  }).then((r) => r.status)
);
const accepted = statuses.filter((s) => s === 201).length;
console.log(`claims: ${accepted} of 20 accepted`);

// 50 clicks at once. Every one should count.
await times(50, () => fetch(`${base}/${slug}`, { redirect: "manual" }));
const { hits } = await fetch(`${base}/${slug}/stats`).then((r) => r.json());
console.log(`clicks: ${hits} of 50 counted`);

if (accepted !== 1 || hits !== 50) process.exit(1);
