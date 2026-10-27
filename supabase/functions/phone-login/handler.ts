/** Retired: editable profile phones and legacy OTPs cannot authenticate accounts. */
export function handler(req: Request): Response {
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  return new Response(JSON.stringify({
    success: false, error: 'O acesso telefónico antigo foi desativado. Entre com o email da conta. Se a conta só tiver telefone, solicite recuperação individual.',
    reason: 'legacy_phone_login_retired',
  }), {status: req.method === 'POST' ? 410 : 405, headers});
}
