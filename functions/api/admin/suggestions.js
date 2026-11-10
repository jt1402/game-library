export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, game, from_name, message, created FROM suggestions ORDER BY created DESC").all();
  return Response.json(results, { headers: { "cache-control": "no-store" } });
}
