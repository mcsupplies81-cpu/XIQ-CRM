create table if not exists schools (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  city text,
  state text,
  division text,
  rank integer,
  maxpreps_url text,
  created_at timestamp default now()
);

create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references schools(id),
  name text not null,
  role text check (role in ('HC', 'AD', 'OC')),
  email text unique,
  phone text,
  x_handle text,
  status text default 'New' check (status in ('New', 'Emailed', 'Called', 'Responded', 'Closed')),
  assigned_to text check (assigned_to in ('Email', 'Calls', 'DMs')),
  notes text,
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
