export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
      return json({ error: "Missing card id." }, 400);
    }

    const upstream = await fetch(
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } }
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      return json({ error: `Card lookup failed (${upstream.status}).`, details: text.slice(0, 300) }, upstream.status);
    }

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    return json({ error: error?.message || "Card lookup failed." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
