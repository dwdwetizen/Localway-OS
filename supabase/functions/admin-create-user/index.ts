import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function getApiKey(
  environmentName: string,
  modernPrefix: "sb_publishable_" | "sb_secret_",
  legacyEnvironmentName: string,
) {
  const encodedKeys = Deno.env.get(environmentName);
  if (encodedKeys) {
    try {
      const keys = JSON.parse(encodedKeys) as Record<string, string>;
      const values = Object.values(keys);
      const modernKey = values.find((key) => key.startsWith(modernPrefix));
      if (modernKey) return modernKey;
    } catch {
      // Fall through to the stable legacy environment variable.
    }
  }
  return Deno.env.get(legacyEnvironmentName);
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request: Request) => {
  if (
    request.method !== "POST" &&
    request.method !== "DELETE" &&
    request.method !== "PATCH"
  ) {
    return reply(405, { error: "Método não permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = getApiKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "sb_publishable_",
    "SUPABASE_ANON_KEY",
  );
  const secretKey = getApiKey(
    "SUPABASE_SECRET_KEYS",
    "sb_secret_",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
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

  if (request.method === "PATCH") {
    let payload: { userId?: string; username?: string; password?: string };

    try {
      payload = await request.json();
    } catch {
      return reply(400, { error: "Dados inválidos." });
    }

    const userId = payload.userId?.trim();
    const username = payload.username?.trim().toLowerCase() || "";
    const password = payload.password || "";
    if (!userId) {
      return reply(400, { error: "Usuário não informado." });
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      return reply(400, {
        error: "Use de 3 a 32 caracteres no usuário: letras minúsculas, números, ponto, traço ou sublinhado.",
      });
    }
    if (password && password.length < 8) {
      return reply(400, { error: "A nova senha deve ter pelo menos 8 caracteres." });
    }

    const { data: targetProfile, error: targetProfileError } = await admin
      .from("profiles")
      .select("id, is_active, username")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      return reply(500, { error: "Não foi possível localizar o perfil do usuário." });
    }
    if (!targetProfile?.is_active) {
      return reply(404, { error: "Usuário ativo não encontrado." });
    }

    const { data: conflictingProfile, error: conflictError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", userId)
      .maybeSingle();
    if (conflictError) {
      return reply(500, { error: "Não foi possível validar o nome de usuário." });
    }
    if (conflictingProfile) {
      return reply(409, { error: "Este nome de usuário já está em uso." });
    }

    const { error: updateUsernameError } = await admin
      .from("profiles")
      .update({ username })
      .eq("id", userId);
    if (updateUsernameError) {
      return reply(400, { error: updateUsernameError.message || "Não foi possível alterar o usuário." });
    }

    if (password) {
      const { error: updatePasswordError } = await admin.auth.admin.updateUserById(userId, {
        password,
      });
      if (updatePasswordError) {
        await admin.from("profiles").update({ username: targetProfile.username }).eq("id", userId);
        return reply(500, {
          error: updatePasswordError.message || "Não foi possível redefinir a senha.",
        });
      }
    }

    return reply(200, { ok: true, username });
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
    username?: string;
    email?: string;
    password?: string;
    nome?: string;
    jobTitle?: string;
    permissions?: string[];
  };

  try {
    payload = await request.json();
  } catch {
    return reply(400, { error: "Dados inválidos." });
  }

  const username = (
    payload.username?.trim().toLowerCase()
    || payload.email?.split("@")[0]?.trim().toLowerCase()
    || ""
  );
  const password = payload.password || "";
  const nome = payload.nome?.trim();
  const jobTitle = payload.jobTitle?.trim() || "SDR / Colaborador";
  const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];

  if (!username || !password || !nome) {
    return reply(400, { error: "Preencha nome, usuário e senha." });
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return reply(400, {
      error: "Use de 3 a 32 caracteres no usuário: letras minúsculas, números, ponto, traço ou sublinhado.",
    });
  }
  if (password.length < 8) {
    return reply(400, { error: "A senha deve ter pelo menos 8 caracteres." });
  }

  const { data: existingProfile, error: usernameLookupError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (usernameLookupError) {
    return reply(500, { error: "Não foi possível validar o nome de usuário." });
  }
  if (existingProfile) {
    return reply(409, { error: "Este nome de usuário já está em uso." });
  }

  const email = `u.${crypto.randomUUID()}@usuarios.localway.app`;
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
    username,
    nome,
    role: "funcionario",
    job_title: jobTitle,
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
