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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return response({ error: 'Function configuration is incomplete.' }, 500);

  let payload: { rollNo?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }
  const rollNo = String(payload.rollNo || '').trim();
  const password = String(payload.password || '');
  if (!rollNo || !password) return response({ error: 'Enter your roll number and password.' }, 400);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: student, error: lookupError } = await adminClient.from('students')
    .select('user_id')
    .ilike('roll_no', rollNo).maybeSingle();
  if (lookupError) return response({ error: 'Unable to verify student account. Try again later.' }, 503);
  if (!student) return response({ error: 'Invalid roll number or password.' }, 401);
  const { data: studentUser, error: userError } = await adminClient.from('users')
    .select('email, active').eq('id', student.user_id).maybeSingle();
  if (userError) return response({ error: 'Unable to verify student account. Try again later.' }, 503);
  if (!studentUser?.active) return response({ error: 'Invalid roll number or password.' }, 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email: studentUser.email, password });
  if (error || !data.session) return response({ error: 'Invalid roll number or password.' }, 401);
  return response({ session: data.session });
});
