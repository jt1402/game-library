export async function onRequestGet({ params, env }) {
  const key = "covers/" + [].concat(params.path).join("/");
  const obj = await env.COVERS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  // Keys are never reused (a replaced cover gets a new key), so cache forever.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}
