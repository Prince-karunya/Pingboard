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
  if (!url || !serviceKey) return response({ error: 'Function configuration is incomplete.' }, 500);
  if (!authorization) return response({ error: 'Authentication is required.' }, 401);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await adminClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (authError || !authData.user) return response({ error: 'Authentication is required.' }, 401);

  const { data: caller, error: callerError } = await adminClient.from('users')
    .select('id, role, active').eq('auth_user_id', authData.user.id).maybeSingle();
  if (callerError) return response({ error: callerError.message }, 500);
  if (!caller?.active || caller.role !== 'faculty') return response({ error: 'Faculty HOD access is required.' }, 403);

  const { data: faculty, error: facultyError } = await adminClient.from('users')
    .select('department, is_hod').eq('id', caller.id).maybeSingle();
  if (facultyError) return response({ error: facultyError.message }, 500);
  if (!faculty?.is_hod || !faculty.department?.trim()) return response({ error: 'Department HOD access is required.' }, 403);
  const hodDepartment = faculty.department.trim().toLowerCase();

  let payload: {
    action?: string;
    student?: Record<string, unknown>;
    students?: Record<string, unknown>[];
    userId?: number;
    changes?: Record<string, unknown>;
  };
  try {
    payload = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (payload.action === 'create' || payload.action === 'create-bulk') {
    const inputs = payload.action === 'create' ? [payload.student || {}] : payload.students;
    if (!inputs?.length || inputs.length > 100) {
      return response({ error: 'Provide between 1 and 100 student accounts per request.' }, 400);
    }
    if (hodDepartment !== 'mca') return response({ error: 'Only the MCA HOD can create student accounts.' }, 403);

    const students = inputs.map((input) => {
      const section = String(input.section || '').trim().toUpperCase();
      return {
        name: String(input.name || '').trim(),
        email: String(input.email || '').trim().toLowerCase(),
        password: String(input.password || ''),
        rollNo: String(input.rollNo || '').trim(),
        section,
        year: section === 'AMCA' ? '1' : section === 'NMCA' ? '2' : '',
      };
    });
    const emails = new Set<string>();
    const rollNumbers = new Set<string>();
    for (const student of students) {
      const rollKey = student.rollNo.toLowerCase();
      if (!student.name || !/^[^@\s]+@gmail\.com$/i.test(student.email)
        || student.password.length < 8 || !student.rollNo || !student.year) {
        return response({ error: 'Each student needs a name, Gmail, password (8+ characters), roll number, and AMCA or NMCA cohort.' }, 400);
      }
      if (emails.has(student.email) || rollNumbers.has(rollKey)) {
        return response({ error: 'The upload contains duplicate emails or roll numbers.' }, 400);
      }
      emails.add(student.email);
      rollNumbers.add(rollKey);
    }

    for (const student of students) {
      const { data: duplicate, error: duplicateError } = await adminClient.from('users')
        .select('id').ilike('roll_no', student.rollNo).maybeSingle();
      if (duplicateError) return response({ error: duplicateError.message }, 500);
      if (duplicate) return response({ error: `Roll number ${student.rollNo} is already registered.` }, 409);
    }

    const createdIds: string[] = [];
    const cleanupCreated = async () => {
      const cleanupErrors: string[] = [];
      for (const id of createdIds.reverse()) {
        const { error } = await adminClient.auth.admin.deleteUser(id);
        if (error) cleanupErrors.push(error.message);
      }
      return cleanupErrors;
    };
    const createdAccounts: Record<string, unknown>[] = [];
    for (const student of students) {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: student.email,
        password: student.password,
        email_confirm: true,
        user_metadata: { provisioned_by_hod: true, name: student.name },
      });
      if (createError || !created.user) {
        const cleanupErrors = await cleanupCreated();
        const message = createError?.message || 'Student account could not be created.';
        return response({
          error: cleanupErrors.length ? `${message} Cleanup failed: ${cleanupErrors.join('; ')}` : message,
        }, 400);
      }
      createdIds.push(created.user.id);
      const { data: account, error: profileError } = await adminClient.from('users').insert({
        auth_user_id: created.user.id,
        name: student.name,
        email: student.email,
        role: 'student',
        active: true,
        roll_no: student.rollNo,
        program_code: 'mca',
        department: 'MCA',
        year: student.year,
        section: student.section,
        is_hod: false,
      }).select('id, name, email, active, roll_no, program_code, department, year, section').single();
      if (profileError || !account) {
        const cleanupErrors = await cleanupCreated();
        const message = profileError?.message || 'Student profile could not be created.';
        return response({
          error: cleanupErrors.length ? `${message} Cleanup failed: ${cleanupErrors.join('; ')}` : message,
        }, 500);
      }
      createdAccounts.push(account);
    }
    return response(payload.action === 'create' ? createdAccounts[0] : { created: createdAccounts }, 201);
  }

  if (!Number.isSafeInteger(payload.userId)) return response({ error: 'A valid student account is required.' }, 400);
  const { data: student, error: studentError } = await adminClient.from('students')
    .select('user_id, department, program_code, year, section').eq('user_id', payload.userId).maybeSingle();
  if (studentError) return response({ error: studentError.message }, 500);
  if (!student || ![student.department, student.program_code].some((value) =>
    String(value || '').trim().toLowerCase() === hodDepartment)) {
    return response({ error: 'This student is outside your department.' }, 403);
  }
  const { data: account, error: accountError } = await adminClient.from('users')
    .select('id, auth_user_id, active').eq('id', student.user_id).maybeSingle();
  if (accountError) return response({ error: accountError.message }, 500);
  if (!account?.auth_user_id) return response({ error: 'Student account was not found.' }, 404);

  if (payload.action === 'update') {
    const changes = payload.changes || {};
    if (changes.department !== undefined) {
      return response({ error: 'A HOD cannot move a student outside their department.' }, 403);
    }
    const studentPatch: Record<string, string> = {};
    const studentFields: Record<string, string> = {
      rollNo: 'roll_no', programCode: 'program_code', year: 'year', section: 'section',
    };
    for (const [field, column] of Object.entries(studentFields)) {
      if (changes[field] !== undefined) studentPatch[column] = String(changes[field]).trim();
    }
    if (studentPatch.program_code) {
      if (studentPatch.program_code.toLowerCase() !== 'mca') {
        return response({ error: 'PingBoard only supports the MCA program.' }, 400);
      }
      studentPatch.program_code = 'mca';
    }
    if (studentPatch.section || studentPatch.year) {
      const nextSection = (studentPatch.section || student.section).toUpperCase();
      const nextYear = studentPatch.year || (nextSection === 'AMCA' ? '1' : '2');
      if (!['AMCA', 'NMCA'].includes(nextSection) || nextYear !== (nextSection === 'AMCA' ? '1' : '2')) {
        return response({ error: 'Use AMCA for Year 1 or NMCA for Year 2.' }, 400);
      }
      studentPatch.section = nextSection;
      studentPatch.year = nextYear;
    }
    if (studentPatch.roll_no) {
      const { data: duplicate, error: duplicateError } = await adminClient.from('students')
        .select('user_id').ilike('roll_no', studentPatch.roll_no).neq('user_id', account.id).maybeSingle();
      if (duplicateError) return response({ error: duplicateError.message }, 500);
      if (duplicate) return response({ error: 'That roll number is already in use.' }, 409);
    }
    if (changes.name !== undefined && !String(changes.name).trim()) {
      return response({ error: 'Student name cannot be empty.' }, 400);
    }
    if (changes.password !== undefined
      && (typeof changes.password !== 'string' || changes.password.length < 8)) {
      return response({ error: 'Password must be at least 8 characters.' }, 400);
    }
    if (changes.active !== undefined && typeof changes.active !== 'boolean') {
      return response({ error: 'Student account status must be active or inactive.' }, 400);
    }

    if (typeof changes.password === 'string') {
      const { error } = await adminClient.auth.admin.updateUserById(account.auth_user_id, { password: changes.password });
      if (error) return response({ error: error.message }, 400);
    }
    if (typeof changes.active === 'boolean') {
      const { error } = await adminClient.from('users').update({ active: changes.active }).eq('id', account.id);
      if (error) return response({ error: error.message }, 400);
      if (!changes.active) {
        const { error: signOutError } = await adminClient.auth.admin.signOut(account.auth_user_id, 'global');
        if (signOutError) return response({ error: signOutError.message }, 400);
      }
    }

    const userPatch: Record<string, string> = {};
    if (changes.name !== undefined) userPatch.name = String(changes.name).trim();
    for (const column of ['roll_no', 'program_code', 'year', 'section']) {
      if (studentPatch[column] !== undefined) userPatch[column] = studentPatch[column];
    }
    if (Object.keys(userPatch).length) {
      const { error } = await adminClient.from('users').update(userPatch).eq('id', account.id);
      if (error) return response({ error: error.message }, 400);
    }
    return response({ success: true });
  }

  if (payload.action === 'deactivate') {
    const { error } = await adminClient.from('users').update({ active: false }).eq('id', account.id);
    if (error) return response({ error: error.message }, 400);
    const { error: signOutError } = await adminClient.auth.admin.signOut(account.auth_user_id, 'global');
    if (signOutError) return response({ error: signOutError.message }, 400);
    return response({ success: true, active: false });
  }

  if (payload.action === 'delete') {
    const { error } = await adminClient.auth.admin.deleteUser(account.auth_user_id);
    if (error) return response({ error: error.message }, 400);
    return response({ success: true, deleted: true });
  }

  return response({ error: 'Unsupported action.' }, 400);
});
