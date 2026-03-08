export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const name = clean(url.searchParams.get("name"));
    const setName = clean(url.searchParams.get("set"));
    const number = clean(url.searchParams.get("number"));

    if (!name && !setName && !number) {
      return json({ error: "Provide a card name, set, or number." }, 400);
    }

    const parts = [];
    if (name) parts.push(`name:"${escapeQuotes(name)}"`);
    if (setName) parts.push(`set.name:"${escapeQuotes(setName)}"`);
    if (number) parts.push(`number:"${escapeQuotes(number.replace(/\s+/g, ""))}"`);

    const query = parts.join(" ");
    const upstreamUrl =
      `https://api.pokemontcg.io/v2/cards?` +
      `q=${encodeURIComponent(query)}` +
      `&pageSize=6` +
      `&select=id,name,number,rarity,set,images,tcgplayer,cardmarket`;

    const upstream = await fetchWithTimeout(upstreamUrl, {
      headers: { Accept: "application/json" }
    }, 8000);

    const text = await upstream.text();

    if (!upstream.ok) {
      return json({
        error: `Card search failed (${upstream.status}).`,
        details: text.slice(0, 300)
      }, upstream.status);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({
        error: "Card API did not return valid JSON.",
        details: text.slice(0, 300)
      }, 502);
    }

    return json(parsed, 200, { "Cache-Control": "public, max-age=120" });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Card search timed out. Try a card name plus set or number."
      : (error?.message || "Search failed.");
    return json({ error: message }, 500);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}
