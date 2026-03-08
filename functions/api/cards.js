export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const number = url.searchParams.get("number");

  let query = "";

  if (name) query = `name:"${name}"`;
  if (number) query = `number:"${number}"`;

  const api = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=10`;

  const res = await fetch(api);

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}
