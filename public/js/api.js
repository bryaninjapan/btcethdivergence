export async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  let body;
  try {
    body = await res.json();
  } catch (e) {
    // Handle non-JSON responses (HTML error pages, etc.)
    throw new Error(res.statusText || 'Request failed');
  }
  if (!res.ok || body.ok !== true) throw new Error(body.error || 'Request failed');
  return body.data;
}