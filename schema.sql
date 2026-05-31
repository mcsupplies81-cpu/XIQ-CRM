create table if not exists schools (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  city text,
  state text,
  division text,
  level text,
  rank integer,
  maxpreps_url text,
  created_at timestamp default now()
);

create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references schools(id),
  name text not null,
  role text check (role in ('HC', 'AD', 'OC', 'DC', 'STC', 'QB', 'WR', 'RB', 'OL', 'DL', 'DB', 'LB', 'TE', 'ST')),
  email text unique,
  phone text,
  x_handle text,
  linkedin_url text,
  status text default 'New' check (status in ('New', 'Emailed', 'Called', 'Responded', 'Closed')),
  assigned_to text check (assigned_to in ('Email', 'Calls', 'DMs')),
  notes text,
  follow_up_at date,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references contacts(id),
  type text check (type in ('call', 'email', 'dm')),
  notes text,
  created_by text,
  created_at timestamp default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_updated_at();

-- Foreign-key and filter indexes (queries join/filter on these constantly)
create index if not exists idx_contacts_school_id on contacts(school_id);
create index if not exists idx_contacts_status on contacts(status);
create index if not exists idx_contacts_follow_up_at on contacts(follow_up_at);
create index if not exists idx_activities_contact_id on activities(contact_id);
create index if not exists idx_activities_created_at on activities(created_at);
create index if not exists idx_deals_school_id on deals(school_id);
create index if not exists idx_deals_stage on deals(stage);
