export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
      return json({ error: "Missing card id." }, 400);
    }

    const upstreamUrl =
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}?` +
      `select=id,name,number,rarity,set,images,tcgplayer,cardmarket`;

    const upstream = await fetchWithTimeout(upstreamUrl, {
      headers: { Accept: "application/json" }
    }, 9000);

    const text = await upstream.text();
    if (!upstream.ok) {
      return json({ error: `Card lookup failed (${upstream.status}).`, details: text.slice(0, 300) }, upstream.status);
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
      ? "Card lookup timed out. Try again in a moment."
      : (error?.message || "Card lookup failed.");
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
