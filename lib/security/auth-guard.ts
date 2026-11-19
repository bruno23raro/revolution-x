export function requireCron(req: Request) {
  const s = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || s !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "cron" } }), { status: 401 });
  }
  return null;
}
export function requireTenant(session: { tenantId?: string } | null) {
  if (!session?.tenantId) return new Response(JSON.stringify({ ok:false, error:{ code:"NO_TENANT", message:"tenant ausente" } }), { status: 403 });
  return null;
}
