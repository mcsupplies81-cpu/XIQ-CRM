create table if not exists deals (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references schools(id),
  contact_id uuid references contacts(id),
  title text not null,
  value numeric,
  stage text default 'Prospecting' check (stage in ('Prospecting', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost')),
  close_date date,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

drop trigger if exists deals_updated_at on deals;
create trigger deals_updated_at
  before update on deals
  for each row execute function update_updated_at();

alter table schools add column if not exists notes text;
