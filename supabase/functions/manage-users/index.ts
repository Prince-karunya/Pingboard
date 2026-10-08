import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !serviceKey || !authorization) return response({ error: 'Function configuration is incomplete.' }, 500);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await adminClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (authError || !authData.user) return response({ error: 'Authentication is required.' }, 401);

  const { data: caller, error: callerError } = await adminClient.from('users')
    .select('role, active').eq('auth_user_id', authData.user.id).maybeSingle();
  if (callerError) return response({ error: callerError.message }, 500);
  if (!caller?.active || caller.role !== 'admin') return response({ error: 'Administrator access is required.' }, 403);

  let payload: {
    action?: string;
    users?: Record<string, unknown>[];
    userId?: number;
    changes?: Record<string, unknown>;
  };
  try {
    payload = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (payload.action === 'create') {
    if (!Array.isArray(payload.users) || payload.users.length === 0) return response({ error: 'At least one user is required.' }, 400);
    if (payload.users.length > 100) return response({ error: 'Create users in batches of 100 or fewer.' }, 400);

    const emails = new Set<string>();
    for (const input of payload.users) {
      const name = String(input.name || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      const role = String(input.role || '');
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8 || role !== 'faculty') {
        return response({ error: 'Administrators can create faculty accounts with a name, valid email, and password of at least 8 characters.' }, 400);
      }
      if (emails.has(email)) return response({ error: `Duplicate email in request: ${email}` }, 400);
      emails.add(email);
      if (String(input.department || '').trim().toLowerCase() !== 'mca') {
        return response({ error: 'PingBoard only supports MCA department faculty.' }, 400);
      }
    }

    const rollbackRecords: {
      authUserId: string;
      existingAccount: Record<string, unknown> | null;
    }[] = [];
    const createdRows: Record<string, unknown>[] = [];
    const rollback = async () => {
      let rollbackError = '';
      for (const record of [...rollbackRecords].reverse()) {
        let safeToDeleteAuthUser = true;
        if (record.existingAccount) {
          const accountFields = [
            'auth_user_id', 'name', 'email', 'role', 'active', 'roll_no',
            'program_code', 'department', 'year', 'section', 'is_hod',
          ];
          const accountSnapshot = Object.fromEntries(
            accountFields.map((field) => [field, record.existingAccount![field] ?? null]),
          );
          const { error: accountRestoreError } = await adminClient.from('users')
            .update(accountSnapshot).eq('id', record.existingAccount.id);
          if (accountRestoreError) {
            safeToDeleteAuthUser = false;
            if (!rollbackError) rollbackError = `Could not restore existing user: ${accountRestoreError.message}`;
          }

        }
        if (safeToDeleteAuthUser) {
          const { error } = await adminClient.auth.admin.deleteUser(record.authUserId);
          if (error && !rollbackError) rollbackError = error.message;
        }
      }
      return rollbackError;
    };

    for (const input of payload.users) {
      const name = String(input.name).trim();
      const email = String(input.email).trim().toLowerCase();
      const role = String(input.role);
      const existingResult = await adminClient.from('users').select('*').ilike('email', email).maybeSingle();
      if (existingResult.error) return response({ error: existingResult.error.message }, 500);
      const existingAccount = existingResult.data;
      if (existingAccount?.auth_user_id) {
        const rollbackError = await rollback();
        const duplicateError = 'An account with this email already exists.';
        return response({ error: rollbackError ? `${duplicateError} Rollback failed: ${rollbackError}` : duplicateError }, 409);
      }
      if (existingAccount && existingAccount.role !== role.toLowerCase()) {
        const rollbackError = await rollback();
        const mismatchError = `Existing account role is ${existingAccount.role}; it cannot be changed while linking its login.`;
        return response({ error: rollbackError ? `${mismatchError} Rollback failed: ${rollbackError}` : mismatchError }, 409);
      }
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password: String(input.password), email_confirm: true, user_metadata: { name },
      });
      if (createError) {
        const rollbackError = await rollback();
        return response({ error: rollbackError ? `${createError.message} Rollback failed: ${rollbackError}` : createError.message }, 400);
      }
      rollbackRecords.push({ authUserId: authUser.user.id, existingAccount });

      const accountResult = existingAccount
        ? await adminClient.from('users').update({
          auth_user_id: authUser.user.id, name, email, role, active: true,
          department: 'MCA', is_hod: Boolean(input.isHod),
        }).eq('id', existingAccount.id).select('*').single()
        : await adminClient.from('users').insert({
          auth_user_id: authUser.user.id, name, email, role, active: true,
          department: 'MCA', is_hod: Boolean(input.isHod),
        }).select('*').single();
      const { data: account, error: accountError } = accountResult;
      if (accountError) {
        const rollbackError = await rollback();
        return response({ error: rollbackError ? `${accountError.message} Rollback failed: ${rollbackError}` : accountError.message }, 400);
      }

      createdRows.push({ ...account, faculty_department: 'MCA', is_hod: Boolean(input.isHod) });
    }
    return response(createdRows);
  }

  if (payload.action === 'update') {
    if (!Number.isSafeInteger(payload.userId) || !payload.changes || typeof payload.changes !== 'object') {
      return response({ error: 'A valid user and changes are required.' }, 400);
    }
    const { data: account, error: accountError } = await adminClient.from('users')
      .select('*').eq('id', payload.userId).maybeSingle();
    if (accountError) return response({ error: accountError.message }, 500);
    if (!account) return response({ error: 'User account was not found.' }, 404);
    if (account.role !== 'faculty') return response({ error: 'Administrators can manage faculty accounts only.' }, 403);

    const changes = payload.changes;
    if (typeof changes.active === 'boolean') {
      const { error } = await adminClient.from('users').update({ active: changes.active }).eq('id', account.id);
      if (error) return response({ error: error.message }, 400);
      if (!changes.active && account.auth_user_id) {
        const { error } = await adminClient.auth.admin.signOut(account.auth_user_id, 'global');
        if (error) return response({ error: error.message }, 400);
      }
    }
    if (changes.password !== undefined) {
      if (typeof changes.password !== 'string' || changes.password.length < 8) {
        return response({ error: 'Password must be at least 8 characters.' }, 400);
      }
      const { error } = await adminClient.auth.admin.updateUserById(account.auth_user_id, { password: changes.password });
      if (error) return response({ error: error.message }, 400);
    }
    const patch: Record<string, unknown> = {};
    if (changes.department !== undefined) {
      const department = String(changes.department).trim();
      if (department.toLowerCase() !== 'mca') return response({ error: 'PingBoard only supports the MCA department.' }, 400);
      patch.department = 'MCA';
    }
    if (changes.isHod !== undefined) patch.is_hod = Boolean(changes.isHod);
    if (Object.keys(patch).length) {
      const { error } = await adminClient.from('users').update(patch).eq('id', account.id);
      if (error) return response({ error: error.message }, 400);
    }
    const { data: freshAccount, error: freshAccountError } = await adminClient.from('users')
      .select('*').eq('id', account.id).single();
    if (freshAccountError) return response({ error: freshAccountError.message }, 500);
    return response({ ...freshAccount, faculty_department: freshAccount.department });
  }

  if (payload.action === 'delete') {
    if (!Number.isSafeInteger(payload.userId)) return response({ error: 'A valid user is required.' }, 400);
    const { data: account, error: accountError } = await adminClient.from('users')
      .select('id, auth_user_id, role').eq('id', payload.userId).maybeSingle();
    if (accountError) return response({ error: accountError.message }, 500);
    if (!account?.auth_user_id) return response({ error: 'User account was not found.' }, 404);
    if (account.role !== 'faculty') return response({ error: 'Administrators can remove faculty accounts only.' }, 403);
    if (account.role === 'faculty') {
      const { error: deactivateError } = await adminClient.from('users').update({ active: false }).eq('id', account.id);
      if (deactivateError) return response({ error: deactivateError.message }, 400);
      await adminClient.auth.admin.signOut(account.auth_user_id, 'global');
      return response({ success: true, deactivated: true });
    }
    const { error } = await adminClient.auth.admin.deleteUser(account.auth_user_id);
    if (error) return response({ error: error.message }, 400);
    return response({ success: true });
  }

  return response({ error: 'Unsupported action.' }, 400);
});
