-- 시황실 schema, RLS, storage
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  nickname text,
  birthday date,
  mbti text,
  blood_type text,
  one_liner text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '대화',
  domain text not null default 'home',
  created_at timestamptz not null default now()
);

create index conversations_user_id_created_at_idx
  on public.conversations (user_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('stock', 'fund', 'coin', 'deposit', 'savings')),
  symbol text,
  name text not null,
  quantity numeric(20, 8) not null default 0,
  avg_price numeric(20, 8) not null default 0,
  cash_balance numeric(20, 2) not null default 0,
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index holdings_user_id_idx on public.holdings (user_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  ticker text,
  edited_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  is_admin_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create index comments_post_id_created_at_idx on public.comments (post_id, created_at);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create index reactions_post_id_idx on public.reactions (post_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  source_url text,
  investor_name text,
  symbol text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index alerts_user_id_created_at_idx on public.alerts (user_id, created_at desc);

create table public.question_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  created_at timestamptz not null default now()
);

create index question_topics_user_id_created_at_idx
  on public.question_topics (user_id, created_at desc);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger holdings_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.enforce_admin_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_admin_reply and not private.is_admin() then
    new.is_admin_reply = false;
  end if;
  return new;
end;
$$;

create trigger comments_enforce_admin_reply
  before insert or update on public.comments
  for each row execute function private.enforce_admin_reply();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.holdings enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.alerts enable row level security;
alter table public.question_topics enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "conversations_own"
  on public.conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "messages_own"
  on public.messages for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "holdings_own"
  on public.holdings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "posts_select"
  on public.posts for select to authenticated
  using (true);

create policy "posts_insert_own"
  on public.posts for insert to authenticated
  with check (user_id = auth.uid());

create policy "posts_update_author_or_admin"
  on public.posts for update to authenticated
  using (user_id = auth.uid() or private.is_admin())
  with check (user_id = auth.uid() or private.is_admin());

create policy "posts_delete_author_or_admin"
  on public.posts for delete to authenticated
  using (user_id = auth.uid() or private.is_admin());

create policy "comments_select"
  on public.comments for select to authenticated
  using (true);

create policy "comments_insert_own"
  on public.comments for insert to authenticated
  with check (user_id = auth.uid());

create policy "comments_update_author_or_admin"
  on public.comments for update to authenticated
  using (user_id = auth.uid() or private.is_admin())
  with check (user_id = auth.uid() or private.is_admin());

create policy "comments_delete_author_or_admin"
  on public.comments for delete to authenticated
  using (user_id = auth.uid() or private.is_admin());

create policy "reactions_select"
  on public.reactions for select to authenticated
  using (true);

create policy "reactions_insert_own"
  on public.reactions for insert to authenticated
  with check (user_id = auth.uid());

create policy "reactions_delete_own"
  on public.reactions for delete to authenticated
  using (user_id = auth.uid());

create policy "alerts_own"
  on public.alerts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "question_topics_own"
  on public.question_topics for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

create policy "attachments_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.alerts;
