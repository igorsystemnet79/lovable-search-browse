-- Oglasi mogu imati do 7 fotografija. Fajlovi se cuvaju u javnom Supabase Storage bucket-u,
-- a ova tabela cuva vezu, izvor i redosled fotografija.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slike-oglasa', 'slike-oglasa', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create table if not exists public.slike_oglasa (
  id uuid primary key default gen_random_uuid(),
  ponuda_id uuid references public.ponude(id) on delete cascade,
  zahtev_id uuid references public.zahtevi(id) on delete cascade,
  storage_path text,
  external_url text,
  pozicija smallint not null default 0 check (pozicija between 0 and 6),
  created_at timestamptz not null default now(),
  constraint slike_oglasa_izvor check (
    (storage_path is not null and external_url is null) or
    (storage_path is null and external_url is not null)
  ),
  constraint slike_oglasa_oglas check (
    (ponuda_id is not null and zahtev_id is null) or
    (ponuda_id is null and zahtev_id is not null)
  )
);

create index if not exists slike_oglasa_ponuda_idx on public.slike_oglasa(ponuda_id, pozicija);
create index if not exists slike_oglasa_zahtev_idx on public.slike_oglasa(zahtev_id, pozicija);
alter table public.slike_oglasa enable row level security;
grant select on public.slike_oglasa to anon, authenticated;
grant insert, update, delete on public.slike_oglasa to authenticated;
grant all on public.slike_oglasa to service_role;

create policy "Fotografije oglasa su javne"
on public.slike_oglasa for select to anon, authenticated using (true);

create policy "Vlasnik dodaje fotografije ponude"
on public.slike_oglasa for insert to authenticated
with check (
  (ponuda_id is not null and exists (
    select 1 from public.ponude p where p.id = ponuda_id and p.user_id = (select auth.uid())
  ) and zahtev_id is null)
  or
  (zahtev_id is not null and exists (
    select 1 from public.zahtevi z where z.id = zahtev_id and z.user_id = (select auth.uid())
  ) and ponuda_id is null)
);

create policy "Vlasnik menja fotografije svog oglasa"
on public.slike_oglasa for update to authenticated
using (
  (ponuda_id is not null and exists (select 1 from public.ponude p where p.id = ponuda_id and p.user_id = (select auth.uid())))
  or
  (zahtev_id is not null and exists (select 1 from public.zahtevi z where z.id = zahtev_id and z.user_id = (select auth.uid())))
)
with check (
  (ponuda_id is not null and exists (select 1 from public.ponude p where p.id = ponuda_id and p.user_id = (select auth.uid())))
  or
  (zahtev_id is not null and exists (select 1 from public.zahtevi z where z.id = zahtev_id and z.user_id = (select auth.uid())))
);

create policy "Vlasnik brise fotografije svog oglasa"
on public.slike_oglasa for delete to authenticated
using (
  (ponuda_id is not null and exists (select 1 from public.ponude p where p.id = ponuda_id and p.user_id = (select auth.uid())))
  or
  (zahtev_id is not null and exists (select 1 from public.zahtevi z where z.id = zahtev_id and z.user_id = (select auth.uid())))
);

create policy "Vlasnik postavlja svoje fotografije"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'slike-oglasa' and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Fotografije oglasa su javno dostupne"
on storage.objects for select to anon, authenticated
using (bucket_id = 'slike-oglasa');

create policy "Vlasnik brise svoje fotografije"
on storage.objects for delete to authenticated
using (
  bucket_id = 'slike-oglasa' and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Ogranicenje od 7 fotografija sprovodi se i na nivou baze, ne samo u interfejsu.
create or replace function public.proveri_broj_slika_oglasa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  broj integer;
begin
  if new.ponuda_id is not null then
    select count(*) into broj from public.slike_oglasa
    where ponuda_id = new.ponuda_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  else
    select count(*) into broj from public.slike_oglasa
    where zahtev_id = new.zahtev_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
  if broj >= 7 then
    raise exception 'Oglas može imati najviše 7 fotografija.';
  end if;
  return new;
end;
$$;

create trigger ogranicenje_broj_slika_oglasa
before insert or update of ponuda_id, zahtev_id on public.slike_oglasa
for each row execute function public.proveri_broj_slika_oglasa();
