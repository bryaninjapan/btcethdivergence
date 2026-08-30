export async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json();
  if (!res.ok || body.ok !== true) throw new Error(body.error || 'Request failed');
  return body.data;
}