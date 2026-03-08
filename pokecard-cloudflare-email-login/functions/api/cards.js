export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const name = clean(url.searchParams.get("name"));
    const setName = clean(url.searchParams.get("set"));
    const number = clean(url.searchParams.get("number"));

    const parts = [];
    if (name) parts.push(`name:"${escapeQuotes(name)}"`);
    if (setName) parts.push(`set.name:"${escapeQuotes(setName)}"`);
    if (number) parts.push(`number:"${escapeQuotes(number.replace(/\s+/g, ""))}"`);

    if (!parts.length) {
      return json({ error: "Provide a card name, set, or number." }, 400);
    }

    const q = parts.join(" ");
    const upstream = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=20&orderBy=set.releaseDate,number`,
      { headers: { Accept: "application/json" } }
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      return json({ error: `Card search failed (${upstream.status}).`, details: text.slice(0, 300) }, upstream.status);
    }

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    return json({ error: error?.message || "Search failed." }, 500);
  }
}

function clean(v) { return String(v || "").trim(); }
function escapeQuotes(v) { return String(v).replace(/"/g, '\"'); }
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
