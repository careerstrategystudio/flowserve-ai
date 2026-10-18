// GET /api/public-config — datos públicos que necesita el panel, y qué está configurado (sí/no, nunca las claves).
import { send } from '../lib/util.js';

export default function handler(req, res) {
  const e = process.env;
  return send(res, 200, {
    supabaseUrl: e.SUPABASE_URL || null,
    supabaseAnonKey: e.SUPABASE_ANON_KEY || null, // la clave "anon" es pública por diseño; la seguridad la pone RLS
    configured: {
      supabase: !!(e.SUPABASE_URL && e.SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY),
      google: !!e.GOOGLE_SERVICE_ACCOUNT_JSON,
      retell: !!e.RETELL_API_KEY,
      secrets: !!(e.TOOL_SECRET && e.WEBHOOK_SECRET && e.ADMIN_SECRET),
      email: !!e.RESEND_API_KEY,
    },
  });
}
