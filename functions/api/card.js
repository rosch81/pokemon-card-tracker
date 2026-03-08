export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const id = clean(url.searchParams.get("id"));

    if (!id) {
      return json({ error: "Missing card id." }, 400);
    }

    const upstream = await fetchWithTimeout(
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}?select=id,name,number,rarity,set,images,tcgplayer,cardmarket`,
      { headers: { Accept: "application/json" } },
      8000
    );

    const text = await upstream.text();

    if (!upstream.ok) {
      return json({
        error: `Card lookup failed (${upstream.status}).`,
        details: text.slice(0, 300)
      }, upstream.status);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({
        error: "Card lookup did not return valid JSON.",
        details: text.slice(0, 300)
      }, 502);
    }

    return json(parsed, 200, { "Cache-Control": "public, max-age=120" });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Card lookup timed out. Try again in a moment."
      : (error?.message || "Card lookup failed.");
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

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}
