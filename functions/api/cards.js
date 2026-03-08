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
    const upstreamUrl =
      `https://api.pokemontcg.io/v2/cards?` +
      `q=${encodeURIComponent(q)}` +
      `&pageSize=8` +
      `&select=id,name,number,rarity,set,images,tcgplayer,cardmarket`;

    const upstream = await fetchWithTimeout(upstreamUrl, {
      headers: { Accept: "application/json" }
    }, 9000);

    const text = await upstream.text();
    if (!upstream.ok) {
      return json({ error: `Card search failed (${upstream.status}).`, details: text.slice(0, 300) }, upstream.status);
    }

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120"
      }
    });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Card search timed out. Try a more specific search."
      : (error?.message || "Search failed.");
    return json({ error: message }, 504);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clean(v) { return String(v || "").trim(); }
function escapeQuotes(v) { return String(v).replace(/"/g, '\\"'); }
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
