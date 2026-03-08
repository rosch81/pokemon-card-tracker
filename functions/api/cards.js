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

    const queries = buildQueries({ name, setName, number });
    let lastError = null;

    for (const query of queries) {
      try {
        const upstreamUrl =
          `https://api.pokemontcg.io/v2/cards?` +
          `q=${encodeURIComponent(query)}` +
          `&pageSize=6` +
          `&select=id,name,number,rarity,set,images,tcgplayer,cardmarket`;

        const upstream = await fetchWithTimeout(
          upstreamUrl,
          { headers: { Accept: "application/json" } },
          8000
        );

        const text = await upstream.text();

        if (!upstream.ok) {
          lastError = `Card search failed (${upstream.status}).`;
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          lastError = "Card API did not return valid JSON.";
          continue;
        }

        if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
          return json(parsed, 200, { "Cache-Control": "public, max-age=120" });
        }
      } catch (error) {
        lastError =
          error?.name === "AbortError"
            ? "Card search timed out. Try a card name plus set or number."
            : error?.message || "Search failed.";
      }
    }

    return json({ data: [], error: lastError || "No cards found." }, 200, {
      "Cache-Control": "public, max-age=60"
    });
  } catch (error) {
    return json(
      {
        error:
          error?.name === "AbortError"
            ? "Card search timed out. Try a more specific search."
            : error?.message || "Search failed."
      },
      500
    );
  }
}

function buildQueries({ name, setName, number }) {
  const queries = [];

  const cleanNumber = number.replace(/\s+/g, "");
  const hasSlash = cleanNumber.includes("/");

  if (name || setName || number) {
    const parts = [];
    if (name) parts.push(`name:"${escapeQuotes(name)}"`);
    if (setName) parts.push(`set.name:"${escapeQuotes(setName)}"`);
    if (cleanNumber) parts.push(`number:${escapeValue(cleanNumber)}`);
    if (parts.length) queries.push(parts.join(" "));
  }

  if (cleanNumber) {
    queries.push(`number:${escapeValue(cleanNumber)}`);

    if (hasSlash) {
      const leftSide = cleanNumber.split("/")[0];
      if (leftSide) queries.push(`number:${escapeValue(leftSide)}`);
    }
  }

  if (name) {
    queries.push(`name:"${escapeQuotes(name)}"`);
  }

  if (name && setName) {
    queries.push(`name:"${escapeQuotes(name)}" set.name:"${escapeQuotes(setName)}"`);
  }

  return [...new Set(queries)];
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

function clean(v) {
  return String(v || "").trim();
}

function escapeQuotes(v) {
  return String(v).replace(/"/g, '\\"');
}

function escapeValue(v) {
  return String(v).replace(/"/g, "").trim();
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}
