-- ============================================================
--  SAT MATH PREP — Supabase Database Setup
--  Run this ENTIRE script in your Supabase SQL Editor
-- ============================================================

-- 1. Profiles table (linked to Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz default now()
);

-- 2. Exams table (created by admins, assigned to all students)
create table public.exams (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  question_ids text[] not null,
  time_limit integer not null default 35,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 3. Results table (exam attempts by students)
create table public.results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id uuid references public.exams(id) on delete set null,
  score integer not null,
  scaled_score integer not null,
  correct integer not null,
  total integer not null,
  time_used integer not null,
  breakdown jsonb,
  answers jsonb,
  created_at timestamptz default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.results enable row level security;

-- Profiles: everyone can read, users can create/update their own
create policy "Anyone can read profiles"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Exams: everyone can read, admins can create/delete
create policy "Anyone can read exams"
  on public.exams for select using (true);

create policy "Admins can create exams"
  on public.exams for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete exams"
  on public.exams for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Results: users see their own, admins see all, users insert their own
create policy "Users read own or admin reads all"
  on public.results for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users insert own results"
  on public.results for insert with check (auth.uid() = user_id);

-- ============================================================
--  AUTO-CREATE PROFILE ON SIGNUP (trigger function)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Student'),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  CREATE YOUR ADMIN ACCOUNT
--  After running this script, sign up in the app with your 
--  email. Then run the following query, replacing the email:
-- ============================================================
--  UPDATE public.profiles 
--  SET role = 'admin' 
--  WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com');
-- ============================================================
