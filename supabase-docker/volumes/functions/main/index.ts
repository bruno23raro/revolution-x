// Main edge function do stack local: roteia /functions/v1/<slug> sem JWT-check
// (VERIFY_JWT=false no compose). shortcut: sem auth no router, dev local só.
Deno.serve((req) => {
  const slug = new URL(req.url).pathname.split('/')[2] ?? 'main';
  if (slug === 'main') return new Response('ok');
  return new Response(`function "${slug}" nao implementada`, { status: 404 });
});
