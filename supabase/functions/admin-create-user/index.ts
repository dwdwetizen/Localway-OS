import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function getDefaultKey(environmentName: string) {
  const encodedKeys = Deno.env.get(environmentName);
  if (encodedKeys) {
    try {
      const keys = JSON.parse(encodedKeys) as Record<string, string>;
      const key = keys.default || Object.values(keys)[0];
      if (key) return key;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return reply(405, { error: "Método não permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS");
  const secretKey = getDefaultKey("SUPABASE_SECRET_KEYS");
  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return reply(500, { error: "Configuração interna do Supabase incompleta." });
  }
  if (!accessToken) {
    return reply(401, { error: "Sessão de administrador ausente." });
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: current, error: userError } = await caller.auth.getUser(accessToken);
  if (userError || !current.user) {
    return reply(401, { error: "Sua sessão expirou. Entre novamente e tente criar o usuário." });
  }

  const { data: profile, error: profileLookupError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", current.user.id)
    .maybeSingle();

  if (profileLookupError) {
    return reply(500, { error: "Não foi possível validar o perfil administrador." });
  }

  const normalizedRole = profile?.role?.trim().toLowerCase();
  if (!profile?.is_active || (normalizedRole !== "admin" && normalizedRole !== "administrador")) {
    return reply(403, { error: "Apenas administradores podem gerenciar usuários." });
  }

  if (request.method === "DELETE") {
    let payload: { userId?: string };

    try {
      payload = await request.json();
    } catch {
      return reply(400, { error: "Dados inválidos." });
    }

    const userId = payload.userId?.trim();
    if (!userId) {
      return reply(400, { error: "Usuário não informado." });
    }
    if (userId === current.user.id) {
      return reply(400, { error: "Você não pode excluir o próprio usuário." });
    }

    const { data: targetProfile, error: targetProfileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      return reply(500, { error: "Não foi possível localizar o perfil do usuário." });
    }
    if (!targetProfile) {
      return reply(404, { error: "Usuário não encontrado." });
    }

    const { error: archiveProfileError } = await admin
      .from("profiles")
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq("id", userId);

    if (archiveProfileError) {
      return reply(500, { error: "Não foi possível arquivar o perfil do usuário." });
    }

    // Avoid Supabase Auth's DELETE endpoint, which rejects this project's
    // modern ES256 credentials. The login is anonymized and blocked for 100 years.
    const { error: disableUserError } = await admin.auth.admin.updateUserById(userId, {
      email: `removido.${userId}@usuarios.localway.app`,
      ban_duration: "876000h",
    });
    if (disableUserError) {
      const { error: restoreError } = await admin.from("profiles").upsert(targetProfile);
      if (restoreError) {
        console.error("Falha ao restaurar perfil:", restoreError.message);
      }
      return reply(500, { error: disableUserError.message || "Não foi possível desativar o login." });
    }

    return reply(200, { ok: true });
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
    is_active: true,
    deleted_at: null,
  });

  if (saveProfileError) {
    console.error("Falha ao salvar perfil:", saveProfileError.message);
    await admin.auth.admin.updateUserById(created.user.id, {
      email: `removido.${created.user.id}@usuarios.localway.app`,
      ban_duration: "876000h",
    });
    return reply(500, { error: "O login foi revertido porque o perfil não pôde ser criado." });
  }

  return reply(200, { ok: true, userId: created.user.id });
});
