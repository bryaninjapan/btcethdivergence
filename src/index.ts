export default {
  async fetch(request: Request): Promise<Response> {
    if (request.url.includes('/api')) {
      return new Response('not implemented', { status: 404 });
    }
    return new Response('ok', { status: 200 });
  },
};