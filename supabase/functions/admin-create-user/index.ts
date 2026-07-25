import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return reply(405, { error: "Método não permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return reply(500, { error: "Configuração interna do Supabase incompleta." });
  }
  if (!accessToken) {
    return reply(401, { error: "Sessão de administrador ausente." });
  }

  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: current, error: userError } = await caller.auth.getUser(accessToken);
  if (userError || !current.user) {
    return reply(401, { error: "Sua sessão expirou. Entre novamente e tente criar o usuário." });
  }

  const { data: profile, error: profileLookupError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", current.user.id)
    .maybeSingle();

  if (profileLookupError) {
    return reply(500, { error: "Não foi possível validar o perfil administrador." });
  }

  const normalizedRole = profile?.role?.trim().toLowerCase();
  if (normalizedRole !== "admin" && normalizedRole !== "administrador") {
    return reply(403, { error: "Apenas administradores podem criar usuários." });
  }

  let payload: {
    email?: string;
    password?: string;
    nome?: string;
    permissions?: string[];
  };

  try {
    payload = await request.json();
  } catch {
    return reply(400, { error: "Dados inválidos." });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password || "";
  const nome = payload.nome?.trim();
  const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];

  if (!email || !password || !nome) {
    return reply(400, { error: "Preencha nome, e-mail e senha." });
  }
  if (password.length < 8) {
    return reply(400, { error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return reply(400, { error: createError?.message || "Não foi possível criar o login." });
  }

  const { error: saveProfileError } = await admin.from("profiles").upsert({
    id: created.user.id,
    email,
    nome,
    role: "funcionario",
    permissions,
  });

  if (saveProfileError) {
    console.error("Falha ao salvar perfil:", saveProfileError.message);
    await admin.auth.admin.deleteUser(created.user.id);
    return reply(500, { error: "O login foi revertido porque o perfil não pôde ser criado." });
  }

  return reply(200, { ok: true, userId: created.user.id });
});
