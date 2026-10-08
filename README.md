# PingBoard

PingBoard is a React/Vite college portal backed by Supabase Auth, Postgres, and private Storage.

## Local setup

1. Install dependencies with `npm install`.
2. Create `.env.local` in this directory:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   Use the project's publishable/anon key here. Never put a Supabase service-role key in a `VITE_` variable or browser code.
3. Apply the database migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migrations store all account types in `public.users`. `students`, `faculty`, and `administrators` are compatibility views over that table, not separate physical tables. The remaining app tables store courses, notices, read receipts, materials, material views, bookmarks, calendar events, and notifications. Review migrations before applying them to a different Supabase project.
4. Deploy the Edge Functions:

   ```bash
   npx supabase functions deploy student-login
   npx supabase functions deploy manage-users
   npx supabase functions deploy manage-students
   ```

   Supabase supplies the functions' server-side project keys. Do not copy the service-role key into `.env.local`.
5. Bootstrap the first administrator:
   - In Supabase Dashboard → Authentication → Users, create an account with the administrator's email and password.
   - In SQL Editor, run this query, replacing the email and name:

     ```sql
     insert into public.users (auth_user_id, name, email, role, active)
       select id, 'College Administrator', lower(email), 'admin', true
       from auth.users
       where lower(email) = lower('admin@your-college.edu')
       on conflict (auth_user_id) do update
         set name = excluded.name, email = excluded.email, role = 'admin', active = true
     returning id;
     ```

   Once signed in as an administrator, manage faculty and HOD permissions from **Faculty**, and assign faculty to courses from **Courses**. HODs manage student accounts and department rosters from **Department Students**.
6. Start the app with `npm run dev`.

## Account and feature model

- PingBoard is configured for the MCA department only. The two cohorts are AMCA (Year 1) and NMCA (Year 2); cohort selection sets the year and section automatically.
- Account identity and role-specific fields live together in `public.users`: student program/cohort/roll number and faculty HOD status are columns on the same row. Role-specific compatibility views preserve existing queries without adding tables.
- Student accounts can only be created by the MCA HOD, individually or by CSV bulk upload. Students sign in with their assigned roll number and password.
- Administrators manage faculty accounts, grant HOD access, and manage courses. HODs can create, view, update, deactivate/reactivate, permanently delete, and export student accounts within the MCA department. Faculty and administrators sign in using their registered email.
- Faculty can publish notices and course materials for assigned courses. HODs can also publish college-wide image notices and export course/year student contact lists as `.xlsx`.
- Published course notices and materials are targeted by program, year, and section. Students can download assigned materials, see notifications, mark notices read/acknowledged, and save personal calendar items.
- Notices and notifications identify their faculty or administrator issuer; student views expose only issuer IDs and names.
- Notice and material uploads use private Storage buckets. Students receive short-lived download links only for items targeted to their class.

## Backend layout

- Simple database explanation: `users` stores every account and its role; `courses` stores classes and their faculty; `notices` stores announcements and `read_receipts` tracks which student read them; `materials` stores course resources and `material_views` tracks resource views; `bookmarks`, `calendar_events`, and `notifications` store each student's saved items, tasks, and alerts.
- The database also preserves `legacy_student_records` as an archive. `students`, `faculty`, and `administrators` are views (saved queries), not extra tables; they keep the app's role-specific queries working while the profile data stays in `users`.
- `supabase/migrations/20261006000000_initial_schema.sql` creates the app's initial course, notice, receipt, material, and bookmark schema.
- `supabase/migrations/20261007000000_student_faculty_hod_features.sql` adds role-related tables, RLS policies, private image storage, calendar events, notifications, account provisioning, and HOD exports.
- `supabase/migrations/20261008000000_department_student_permissions.sql` restricts student records, exports, and account management to their department's HOD.
- `supabase/migrations/20261009000000_hod_directory_department_scope.sql` limits HOD directory results to their department.
- `supabase/migrations/20261010000000_mca_only_two_cohorts.sql` restricts student/course data to MCA, AMCA Year 1, and NMCA Year 2.
- `supabase/migrations/20261011000000_consolidate_role_profiles.sql` moves student, faculty, and administrator profile columns into `public.users`, replacing the three role tables with compatibility views. It preserves the existing legacy student archive table.
- `supabase/migrations/20261012000000_hod_only_student_provisioning.sql` blocks public student profile creation; HOD management creates Auth accounts and profiles through the authorized server function.
- `supabase/migrations/20261013000000_notice_notification_issuers.sql` records notification issuers and makes issuer names available to authenticated readers.
- `supabase/functions/student-login/index.ts` authenticates students by roll number without exposing the email lookup to anonymous clients.
- `supabase/functions/manage-users/index.ts` provisions and manages faculty accounts using the server-side service role.
- `supabase/functions/manage-students/index.ts` lets authenticated HODs manage student accounts in their own department.
- `src/context/AppContext.jsx` loads permitted Supabase data and implements the app's database and Storage actions.

## Production notes

- HOD-created student accounts are confirmed server-side and can sign in immediately with their assigned roll number and password.
- Notifications are in-app and update live through Supabase Realtime; they are not email or push notifications.
- Configure password and rate-limit policies in the Supabase Dashboard before production use.
