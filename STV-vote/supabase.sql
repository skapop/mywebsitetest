-- Generalforsamling - Supabase database
-- Kjør dette i Supabase SQL Editor.
-- Dette er en prototype-policy: alle som kjenner nettadressen kan lese/skrive data.
-- Før ekte bruk må admin-autentisering, voter codes og strengere RLS-regler innføres.

create extension if not exists pgcrypto;

drop table if exists winners cascade;
drop table if exists votes cascade;
drop table if exists candidates cascade;
drop table if exists elections cascade;

create table elections (
  id uuid primary key default gen_random_uuid(),
  position_key text unique not null,
  position_name text not null,
  position_number integer not null,
  seats integer not null default 1,
  status text not null default 'waiting' check (status in ('waiting','active','finished')),
  representation_enabled boolean not null default false,
  representation_group text,
  representation_required integer not null default 0,
  result_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  name text not null,
  group_name text,
  created_at timestamptz not null default now()
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  voter_code text not null,
  ranking jsonb not null,
  created_at timestamptz not null default now(),
  unique (election_id, voter_code)
);

create table winners (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  vote_count numeric,
  created_at timestamptz not null default now()
);

alter table elections enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;
alter table winners enable row level security;

-- Prototype policies. Replace with authenticated/admin policies before real use.
create policy "prototype elections read" on elections for select using (true);
create policy "prototype elections insert" on elections for insert with check (true);
create policy "prototype elections update" on elections for update using (true) with check (true);

create policy "prototype candidates read" on candidates for select using (true);
create policy "prototype candidates insert" on candidates for insert with check (true);
create policy "prototype candidates update" on candidates for update using (true) with check (true);
create policy "prototype candidates delete" on candidates for delete using (true);

create policy "prototype votes insert" on votes for insert with check (true);
create policy "prototype votes read" on votes for select using (true);

create policy "prototype winners read" on winners for select using (true);
create policy "prototype winners insert" on winners for insert with check (true);

insert into elections (position_key, position_name, position_number, seats, representation_required)
values
('leder','Leder',1,1,0),
('nestleder','Nestleder',2,1,0),
('okonomi','Økonomiansvarlig',3,1,0),
('pr','PR-ansvarlig',4,1,0),
('bedrift','Bedriftsansvarlig',5,1,0),
('hbar','HBAR-ansvarlig',6,1,0),
('arrangement','Arrangementsansvarlig',7,1,0),
('internasjonalt','Internasjonalt ansvarlig',8,1,0),
('styre','Styremedlemmer',9,4,2)
on conflict (position_key) do nothing;
