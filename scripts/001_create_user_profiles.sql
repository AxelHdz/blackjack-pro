-- Create user profiles table to store game statistics
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.user_profiles enable row level security;

-- RLS Policies
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

-- Create game stats table
create table if not exists public.game_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  -- Overall stats
  total_money integer default 500,
  level integer default 1,
  experience integer default 0,
  hands_played integer default 0,
  correct_moves integer default 0,
  total_moves integer default 0,
  wins integer default 0,
  losses integer default 0,
  pushes integer default 0,
  -- Learning mode stats
  learning_hands_played integer default 0,
  learning_correct_moves integer default 0,
  learning_total_moves integer default 0,
  learning_wins integer default 0,
  learning_losses integer default 0,
  -- Practice mode stats
  practice_hands_played integer default 0,
  practice_correct_moves integer default 0,
  practice_total_moves integer default 0,
  practice_wins integer default 0,
  practice_losses integer default 0,
  -- Expert mode stats
  expert_hands_played integer default 0,
  expert_correct_moves integer default 0,
  expert_total_moves integer default 0,
  expert_wins integer default 0,
  expert_losses integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for game stats
alter table public.game_stats enable row level security;

-- RLS Policies for game stats
create policy "Users can view their own stats"
  on public.game_stats for select
  using (auth.uid() = user_id);

create policy "Users can insert their own stats"
  on public.game_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own stats"
  on public.game_stats for update
  using (auth.uid() = user_id);

-- Create trigger to auto-create profile and stats on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert user profile
  insert into public.user_profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  -- Insert default game stats
  insert into public.game_stats (user_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
