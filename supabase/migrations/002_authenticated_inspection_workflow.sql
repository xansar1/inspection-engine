alter table public.inspections
  add column if not exists applicability jsonb not null default '{}'::jsonb,
  add column if not exists progress jsonb not null default '{}'::jsonb,
  add column if not exists selected_mechanic_id uuid references public.profiles(id),
  add column if not exists reinspection_of uuid references public.inspections(id);

alter table public.checkpoint_results
  add column if not exists applicable boolean,
  add column if not exists count_value text,
  add column if not exists observation text,
  add column if not exists applicability_reason text,
  add column if not exists evidence_due boolean not null default false,
  add column if not exists auto_value text,
  add column if not exists measured_value_input text;

do $$
begin
  if exists (
    select 1
    from public.evidence
    group by storage_path
    having count(*) > 1
  ) then
    raise exception 'Cannot add evidence storage-path uniqueness: duplicate paths exist.';
  end if;
  if exists (
    select 1
    from public.repair_jobs
    where checkpoint_result_id is not null
    group by checkpoint_result_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add one-repair-per-checkpoint constraint: duplicate repair jobs exist.';
  end if;
end
$$;

create unique index if not exists evidence_storage_path_unique
  on public.evidence(storage_path);

do $$
begin
  if exists (
    select 1
    from public.inspections
    where status in ('draft', 'in_progress')
    group by vehicle_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add one-open-inspection-per-vehicle constraint: duplicate open sessions exist.';
  end if;
end
$$;

create unique index if not exists inspections_one_open_per_vehicle
  on public.inspections(vehicle_id)
  where status in ('draft', 'in_progress');

create index if not exists inspections_reinspection_of_idx
  on public.inspections(reinspection_of)
  where reinspection_of is not null;

do $$
begin
  if exists (
    select 1
    from public.inspections
    where reinspection_of is not null
    group by reinspection_of
    having count(*) > 1
  ) then
    raise exception 'Cannot add one-reinspection-per-session constraint: duplicate reinspection links exist.';
  end if;
end
$$;

create unique index if not exists inspections_one_reinspection_per_parent
  on public.inspections(reinspection_of)
  where reinspection_of is not null;

create unique index if not exists repair_jobs_one_per_checkpoint_result
  on public.repair_jobs(checkpoint_result_id)
  where checkpoint_result_id is not null;

create table if not exists public.inspection_applicability_authorizations (
  inspection_id uuid not null,
  checkpoint_no int not null,
  reason text not null check (length(btrim(reason)) between 10 and 500),
  authorized_by uuid not null references public.profiles(id),
  authorized_at timestamptz not null default now(),
  primary key (inspection_id, checkpoint_no),
  foreign key (inspection_id, checkpoint_no)
    references public.checkpoint_results(inspection_id, checkpoint_no)
    on delete cascade
);

alter table public.vehicle_ratings
  drop constraint if exists vehicle_ratings_check;
alter table public.vehicle_ratings
  drop constraint if exists vehicle_ratings_sale_ready_requires_clearance;

alter table public.vehicle_ratings
  add constraint vehicle_ratings_sale_ready_requires_clearance
  check (
    not sale_ready or
    (safety_clearance = 'cleared' and critical_failures = 0)
  );

alter table public.quality_reviews
  drop constraint if exists quality_reviews_review_type_check;
alter table public.quality_reviews
  add constraint quality_reviews_review_type_check
  check (review_type in ('repair_verification', 'blind_reaudit', 'final_approval'));

do $$
begin
  if exists (
    select 1
    from public.quality_reviews
    where review_type = 'final_approval'
    group by inspection_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add one-final-approval constraint: duplicate final approvals exist.';
  end if;
end
$$;

create unique index if not exists quality_reviews_one_final_approval
  on public.quality_reviews(inspection_id)
  where review_type = 'final_approval';

update public.vehicle_ratings
set sale_ready = false
where sale_ready;

create or replace function public.guard_vehicle_rating_sale_ready()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sale_ready then
    if public.current_inspection_role() not in ('admin', 'quality_controller')
       or new.safety_clearance <> 'cleared'
       or new.critical_failures <> 0
       or not exists (
         select 1
         from public.inspections i
         join public.quality_reviews q on q.inspection_id = i.id
         where i.id = new.inspection_id
           and i.status = 'approved'
           and q.review_type = 'final_approval'
           and q.status = 'approved'
       ) then
      raise exception 'Sale readiness requires an approved inspection, QC approval, cleared safety status, and zero critical failures.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_vehicle_rating_sale_ready()
  from public, anon, authenticated;

drop trigger if exists vehicle_rating_sale_ready_requires_qc
  on public.vehicle_ratings;
create trigger vehicle_rating_sale_ready_requires_qc
before insert or update on public.vehicle_ratings
for each row execute function public.guard_vehicle_rating_sale_ready();

create or replace function public.current_inspection_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
  limit 1
$$;

revoke all on function public.current_inspection_role() from public, anon;
grant execute on function public.current_inspection_role() to authenticated;
revoke all on function public.refresh_vehicle_rating(uuid) from public, anon, authenticated;

create or replace function public.is_assigned_repair_inspection(
  p_inspection_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_inspection_role() = 'mechanic'
    and exists (
      select 1
      from public.repair_jobs j
      where j.inspection_id = p_inspection_id
        and j.assigned_mechanic_id = auth.uid()
        and j.status in ('assigned', 'in_progress', 'completed')
    )
$$;

revoke all on function public.is_assigned_repair_inspection(uuid)
  from public, anon;
grant execute on function public.is_assigned_repair_inspection(uuid)
  to authenticated;

create or replace function public.has_assigned_repair_for_vehicle(
  p_vehicle_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_inspection_role() = 'mechanic'
    and exists (
      select 1
      from public.repair_jobs j
      join public.inspections i on i.id = j.inspection_id
      where i.vehicle_id = p_vehicle_id
        and j.assigned_mechanic_id = auth.uid()
        and j.status in ('assigned', 'in_progress', 'completed')
    )
$$;

revoke all on function public.has_assigned_repair_for_vehicle(uuid)
  from public, anon;
grant execute on function public.has_assigned_repair_for_vehicle(uuid)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.inspection_sections enable row level security;
alter table public.inspection_checkpoints enable row level security;
alter table public.inspections enable row level security;
alter table public.checkpoint_results enable row level security;
alter table public.evidence enable row level security;
alter table public.vehicle_ratings enable row level security;
alter table public.repair_jobs enable row level security;
alter table public.repair_updates enable row level security;
alter table public.quality_reviews enable row level security;
alter table public.vehicle_reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.inspector_dealer_assignments enable row level security;
alter table public.inspector_accuracy_events enable row level security;
alter table public.inspection_applicability_authorizations enable row level security;

revoke all on public.profiles,
  public.vehicles,
  public.inspection_sections,
  public.inspection_checkpoints,
  public.inspections,
  public.checkpoint_results,
  public.evidence,
  public.vehicle_ratings,
  public.repair_jobs,
  public.repair_updates,
  public.quality_reviews,
  public.vehicle_reports,
  public.audit_logs,
  public.inspector_dealer_assignments,
  public.inspector_accuracy_events,
  public.inspection_applicability_authorizations
from anon, public, authenticated;

grant select on public.profiles,
  public.inspection_sections,
  public.inspection_checkpoints
to authenticated;
grant select, insert on public.vehicles to authenticated;
grant select on public.inspections to authenticated;
grant insert (vehicle_id, inspector_id, status)
  on public.inspections to authenticated;
grant update (
  status,
  applicability,
  progress,
  gps_lat,
  gps_lng,
  selected_mechanic_id
) on public.inspections to authenticated;
grant select, insert, update on public.checkpoint_results to authenticated;
grant select, insert, delete on public.evidence to authenticated;
grant select on public.vehicle_ratings,
  public.repair_jobs,
  public.repair_updates,
  public.quality_reviews,
  public.vehicle_reports,
  public.inspection_applicability_authorizations
to authenticated;
grant select on public.inspector_dealer_assignments,
  public.inspector_accuracy_events,
  public.audit_logs
to authenticated;

drop policy if exists profiles_read_self_and_workshop_staff on public.profiles;
create policy profiles_read_self_and_workshop_staff
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (
    public.current_inspection_role() in ('admin', 'inspector')
    and is_active
    and role in ('inspector', 'mechanic')
  )
);

drop policy if exists inspection_checklist_read_staff on public.inspection_sections;
create policy inspection_checklist_read_staff
on public.inspection_sections for select to authenticated
using (
  public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
);

drop policy if exists inspection_checkpoints_read_staff on public.inspection_checkpoints;
create policy inspection_checkpoints_read_staff
on public.inspection_checkpoints for select to authenticated
using (
  public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
);

drop policy if exists vehicles_read_staff on public.vehicles;
create policy vehicles_read_staff
on public.vehicles for select to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
  or (
    public.current_inspection_role() = 'mechanic'
    and public.has_assigned_repair_for_vehicle(id)
  )
);

drop policy if exists vehicles_insert_staff on public.vehicles;
create policy vehicles_insert_staff
on public.vehicles for insert to authenticated
with check (
  public.current_inspection_role() in ('admin', 'inspector')
  and created_by = auth.uid()
);

drop policy if exists inspections_read_owner_or_admin on public.inspections;
create policy inspections_read_owner_or_admin
on public.inspections for select to authenticated
using (
  public.current_inspection_role() in (
    'admin', 'inspector', 'quality_controller', 'mechanic'
  )
  and (
    inspector_id = auth.uid()
    or public.current_inspection_role() = 'admin'
    or (
      public.current_inspection_role() = 'quality_controller'
      and status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
    )
    or (
      public.current_inspection_role() = 'mechanic'
      and public.is_assigned_repair_inspection(inspections.id)
    )
  )
);

drop policy if exists inspections_insert_self on public.inspections;
create policy inspections_insert_self
on public.inspections for insert to authenticated
with check (
  inspector_id = auth.uid()
  and public.current_inspection_role() in ('admin', 'inspector')
  and status in ('draft', 'in_progress')
);

drop policy if exists inspections_update_open_owner_or_admin on public.inspections;
create policy inspections_update_open_owner_or_admin
on public.inspections for update to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector')
  and (inspector_id = auth.uid() or public.current_inspection_role() = 'admin')
  and status in ('draft', 'in_progress')
)
with check (
  public.current_inspection_role() in ('admin', 'inspector')
  and (inspector_id = auth.uid() or public.current_inspection_role() = 'admin')
  and status in ('draft', 'in_progress')
  and (
    selected_mechanic_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = inspections.selected_mechanic_id
        and p.role = 'mechanic'
        and p.is_active
    )
  )
);

drop policy if exists checkpoint_results_read_owner_or_admin on public.checkpoint_results;
create policy checkpoint_results_read_owner_or_admin
on public.checkpoint_results for select to authenticated
using (
  exists (
    select 1
    from public.inspections i
    where i.id = checkpoint_results.inspection_id
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or (
          public.current_inspection_role() = 'quality_controller'
          and i.status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
        )
      )
  )
);

drop policy if exists checkpoint_results_insert_open_owner on public.checkpoint_results;
create policy checkpoint_results_insert_open_owner
on public.checkpoint_results for insert to authenticated
with check (
  assessed_by = auth.uid()
  and public.current_inspection_role() in ('admin', 'inspector')
  and exists (
    select 1
    from public.inspections i
    where i.id = checkpoint_results.inspection_id
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists checkpoint_results_update_open_owner on public.checkpoint_results;
create policy checkpoint_results_update_open_owner
on public.checkpoint_results for update to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector')
  and exists (
    select 1
    from public.inspections i
    where i.id = checkpoint_results.inspection_id
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
)
with check (
  assessed_by = auth.uid()
  and public.current_inspection_role() in ('admin', 'inspector')
  and exists (
    select 1
    from public.inspections i
    where i.id = checkpoint_results.inspection_id
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists evidence_read_owner_or_admin on public.evidence;
create policy evidence_read_owner_or_admin
on public.evidence for select to authenticated
using (
  exists (
    select 1
    from public.checkpoint_results r
    join public.inspections i on i.id = r.inspection_id
    where r.id = evidence.checkpoint_result_id
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or (
          public.current_inspection_role() = 'quality_controller'
          and i.status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
        )
      )
  )
);

drop policy if exists evidence_insert_open_owner on public.evidence;
create policy evidence_insert_open_owner
on public.evidence for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.checkpoint_results r
    join public.inspections i on i.id = r.inspection_id
    where r.id = evidence.checkpoint_result_id
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
      and exists (
        select 1
        from storage.objects o
        where o.bucket_id = 'inspection-evidence'
          and o.name = evidence.storage_path
          and (storage.foldername(o.name))[1] = i.id::text
          and (storage.foldername(o.name))[2] = r.checkpoint_no::text
      )
  )
);

drop policy if exists evidence_update_open_owner on public.evidence;
drop policy if exists evidence_delete_open_owner on public.evidence;
create policy evidence_delete_open_owner
on public.evidence for delete to authenticated
using (
  exists (
    select 1
    from public.checkpoint_results r
    join public.inspections i on i.id = r.inspection_id
    where r.id = evidence.checkpoint_result_id
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists vehicle_ratings_read_owner_or_admin on public.vehicle_ratings;
create policy vehicle_ratings_read_owner_or_admin
on public.vehicle_ratings for select to authenticated
using (
  exists (
    select 1
    from public.inspections i
    where i.id = vehicle_ratings.inspection_id
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or (
          public.current_inspection_role() = 'quality_controller'
          and i.status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
        )
      )
  )
);

drop policy if exists repair_jobs_read_owner_or_admin on public.repair_jobs;
create policy repair_jobs_read_owner_or_admin
on public.repair_jobs for select to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector', 'quality_controller', 'mechanic')
  and exists (
    select 1
    from public.inspections i
    where i.id = repair_jobs.inspection_id
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller', 'mechanic')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or public.current_inspection_role() = 'quality_controller'
        or repair_jobs.assigned_mechanic_id = auth.uid()
      )
  )
);

drop policy if exists repair_updates_read_authorized_staff on public.repair_updates;
create policy repair_updates_read_authorized_staff
on public.repair_updates for select to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector', 'quality_controller', 'mechanic')
  and exists (
    select 1
    from public.repair_jobs j
    join public.inspections i on i.id = j.inspection_id
    where j.id = repair_updates.repair_job_id
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() in ('admin', 'quality_controller')
        or j.assigned_mechanic_id = auth.uid()
      )
  )
);

drop policy if exists quality_reviews_read_authorized_staff on public.quality_reviews;
create policy quality_reviews_read_authorized_staff
on public.quality_reviews for select to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
  and (
    public.current_inspection_role() in ('admin', 'quality_controller')
    or exists (
      select 1
      from public.inspections i
      where i.id = quality_reviews.inspection_id
        and i.inspector_id = auth.uid()
    )
  )
);

drop policy if exists vehicle_reports_read_authorized_staff on public.vehicle_reports;
create policy vehicle_reports_read_authorized_staff
on public.vehicle_reports for select to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
  and (
    public.current_inspection_role() in ('admin', 'quality_controller')
    or exists (
      select 1
      from public.inspections i
      where i.id = vehicle_reports.inspection_id
        and i.inspector_id = auth.uid()
    )
  )
);

drop policy if exists audit_logs_read_admin on public.audit_logs;
create policy audit_logs_read_admin
on public.audit_logs for select to authenticated
using (public.current_inspection_role() = 'admin');

drop policy if exists inspector_dealer_assignments_read_admin on public.inspector_dealer_assignments;
create policy inspector_dealer_assignments_read_admin
on public.inspector_dealer_assignments for select to authenticated
using (public.current_inspection_role() = 'admin');

drop policy if exists inspector_accuracy_events_read_admin on public.inspector_accuracy_events;
create policy inspector_accuracy_events_read_admin
on public.inspector_accuracy_events for select to authenticated
using (public.current_inspection_role() = 'admin');

drop policy if exists applicability_authorizations_read_owner_or_admin on public.inspection_applicability_authorizations;
create policy applicability_authorizations_read_owner_or_admin
on public.inspection_applicability_authorizations for select to authenticated
using (
  public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
  and (
    public.current_inspection_role() in ('admin', 'quality_controller')
    or exists (
      select 1
      from public.inspections i
      where i.id = inspection_applicability_authorizations.inspection_id
        and i.inspector_id = auth.uid()
    )
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inspection-evidence',
  'inspection-evidence',
  false,
  20 * 1024 * 1024,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = least(
      coalesce(storage.buckets.file_size_limit, 20 * 1024 * 1024),
      20 * 1024 * 1024
    ),
    allowed_mime_types = case
      when storage.buckets.allowed_mime_types is null then
        excluded.allowed_mime_types
      else array(
        select allowed
        from unnest(storage.buckets.allowed_mime_types) as existing(allowed)
        where allowed = any(excluded.allowed_mime_types)
      )
    end;

grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists inspection_evidence_read_owner_or_admin on storage.objects;
create policy inspection_evidence_read_owner_or_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-evidence'
  and exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or (
          public.current_inspection_role() = 'quality_controller'
          and i.status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
        )
      )
  )
);

drop policy if exists inspection_evidence_insert_open_owner on storage.objects;
create policy inspection_evidence_insert_open_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-evidence'
  and exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists inspection_evidence_update_open_owner on storage.objects;
create policy inspection_evidence_update_open_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'inspection-evidence'
  and exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
)
with check (
  bucket_id = 'inspection-evidence'
  and exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists inspection_evidence_delete_open_owner on storage.objects;
create policy inspection_evidence_delete_open_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'inspection-evidence'
  and exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists inspection_evidence_anonymous_deny on storage.objects;
create policy inspection_evidence_anonymous_deny
on storage.objects as restrictive for all to anon
using (bucket_id <> 'inspection-evidence')
with check (bucket_id <> 'inspection-evidence');

drop policy if exists inspection_evidence_authenticated_read_guard on storage.objects;
create policy inspection_evidence_authenticated_read_guard
on storage.objects as restrictive for select to authenticated
using (
  bucket_id <> 'inspection-evidence'
  or exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or (
          public.current_inspection_role() = 'quality_controller'
          and i.status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
        )
      )
  )
);

drop policy if exists inspection_evidence_authenticated_write_guard on storage.objects;
create policy inspection_evidence_authenticated_write_guard
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'inspection-evidence'
  or exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector', 'quality_controller')
      and (
        i.inspector_id = auth.uid()
        or public.current_inspection_role() = 'admin'
        or (
          public.current_inspection_role() = 'quality_controller'
          and i.status in ('submitted', 'repair_required', 'qc_pending', 'approved', 'rejected')
        )
      )
  )
)
with check (
  bucket_id <> 'inspection-evidence'
  or exists (
    select 1
    from public.inspections i
    join public.checkpoint_results r on r.inspection_id = i.id
    where i.id::text = (storage.foldername(name))[1]
      and r.checkpoint_no::text = (storage.foldername(name))[2]
      and public.current_inspection_role() in ('admin', 'inspector')
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

create or replace function public.guard_checkpoint_result_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection_id uuid;
  v_owner uuid;
  v_status text;
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.inspection_id is distinct from old.inspection_id
    or new.checkpoint_no is distinct from old.checkpoint_no
  ) then
    raise exception 'Checkpoint result identity cannot be changed.'
      using errcode = '42501';
  end if;

  v_inspection_id := case when tg_op = 'DELETE' then old.inspection_id else new.inspection_id end;

  select i.inspector_id, i.status
  into v_owner, v_status
  from public.inspections i
  where i.id = v_inspection_id
  for update;

  if not found
     or v_owner is distinct from auth.uid()
     or public.current_inspection_role() not in ('admin', 'inspector')
     or v_status not in ('draft', 'in_progress') then
    raise exception 'Checkpoint results can only change while the owned inspection is open.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_checkpoint_result_write()
  from public, anon, authenticated;

drop trigger if exists checkpoint_results_lock_open_inspection
  on public.checkpoint_results;
create trigger checkpoint_results_lock_open_inspection
before insert or update or delete on public.checkpoint_results
for each row execute function public.guard_checkpoint_result_write();

create or replace function public.guard_evidence_row_write()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_result_id uuid;
  v_inspection_id uuid;
  v_checkpoint_no int;
  v_owner uuid;
  v_status text;
  v_path text;
  v_media_type text;
  v_object_mime text;
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.checkpoint_result_id is distinct from old.checkpoint_result_id
    or new.storage_path is distinct from old.storage_path
    or new.media_type is distinct from old.media_type
    or new.uploaded_by is distinct from old.uploaded_by
  ) then
    raise exception 'Evidence identity and media type are immutable.'
      using errcode = '42501';
  end if;

  v_result_id := case when tg_op = 'DELETE' then old.checkpoint_result_id else new.checkpoint_result_id end;
  v_path := case when tg_op = 'DELETE' then old.storage_path else new.storage_path end;
  v_media_type := case when tg_op = 'DELETE' then old.media_type else new.media_type end;

  select r.inspection_id, r.checkpoint_no, i.inspector_id, i.status
  into v_inspection_id, v_checkpoint_no, v_owner, v_status
  from public.checkpoint_results r
  join public.inspections i on i.id = r.inspection_id
  where r.id = v_result_id
  for update of i;

  if not found
     or v_owner is distinct from auth.uid()
     or public.current_inspection_role() not in ('admin', 'inspector')
     or v_status not in ('draft', 'in_progress')
     or (storage.foldername(v_path))[1] is distinct from v_inspection_id::text
     or (storage.foldername(v_path))[2] is distinct from v_checkpoint_no::text then
    raise exception 'Evidence must belong to an open inspection checkpoint owned by the active staff member.'
      using errcode = '42501';
  end if;

  if tg_op <> 'DELETE' then
    select lower(o.metadata ->> 'mimetype')
    into v_object_mime
    from storage.objects o
    where o.bucket_id = 'inspection-evidence'
      and o.name = v_path;

    if not found
       or v_object_mime is null
       or (
         v_media_type = 'photo'
         and v_object_mime not in ('image/jpeg', 'image/png', 'image/webp')
       )
       or (
         v_media_type = 'video'
         and v_object_mime not in ('video/mp4', 'video/quicktime', 'video/webm')
       ) then
      raise exception 'Evidence media type does not match an allowed stored object MIME type.'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_evidence_row_write()
  from public, anon, authenticated;

drop trigger if exists evidence_lock_open_inspection
  on public.evidence;
create trigger evidence_lock_open_inspection
before insert or update or delete on public.evidence
for each row execute function public.guard_evidence_row_write();

create or replace function public.invalidate_applicability_authorization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.applicable is distinct from new.applicable
     or old.result_status is distinct from new.result_status
     or old.applicability_reason is distinct from new.applicability_reason then
    delete from public.inspection_applicability_authorizations a
    where a.inspection_id = new.inspection_id
      and a.checkpoint_no = new.checkpoint_no;
  end if;
  return new;
end;
$$;

revoke all on function public.invalidate_applicability_authorization()
  from public, anon, authenticated;

drop trigger if exists checkpoint_result_invalidate_applicability_authorization
  on public.checkpoint_results;
create trigger checkpoint_result_invalidate_applicability_authorization
after update on public.checkpoint_results
for each row execute function public.invalidate_applicability_authorization();

create or replace function public.guard_inspection_evidence_object_write()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_name text;
  v_bucket text;
  v_parts text[];
  v_owner uuid;
  v_status text;
begin
  if tg_op = 'UPDATE'
     and old.bucket_id = 'inspection-evidence'
     and (new.bucket_id is distinct from old.bucket_id or new.name is distinct from old.name) then
    raise exception 'Inspection evidence object paths are immutable.'
      using errcode = '42501';
  end if;

  v_name := case when tg_op = 'DELETE' then old.name else new.name end;
  v_bucket := case when tg_op = 'DELETE' then old.bucket_id else new.bucket_id end;
  if v_bucket <> 'inspection-evidence' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_parts := storage.foldername(v_name);
  if coalesce(array_length(v_parts, 1), 0) <> 2 then
    raise exception 'Inspection evidence paths must be inspection-id/checkpoint-number/file.'
      using errcode = '23514';
  end if;

  select i.inspector_id, i.status
  into v_owner, v_status
  from public.inspections i
  join public.checkpoint_results r
    on r.inspection_id = i.id
   and r.checkpoint_no::text = v_parts[2]
  where i.id::text = v_parts[1]
  for update of i;

  if not found
     or v_owner is distinct from auth.uid()
     or public.current_inspection_role() not in ('admin', 'inspector')
     or v_status not in ('draft', 'in_progress') then
    raise exception 'Evidence objects can only change for a checkpoint in an owned open inspection.'
      using errcode = '42501';
  end if;

  if tg_op <> 'DELETE' and lower(coalesce(new.metadata ->> 'mimetype', '')) not in (
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ) then
    raise exception 'Unsupported inspection evidence MIME type.'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and exists (
    select 1
    from public.evidence e
    where e.storage_path = new.name
      and (
        (e.media_type = 'photo'
          and lower(coalesce(new.metadata ->> 'mimetype', '')) not in ('image/jpeg', 'image/png', 'image/webp'))
        or
        (e.media_type = 'video'
          and lower(coalesce(new.metadata ->> 'mimetype', '')) not in ('video/mp4', 'video/quicktime', 'video/webm'))
      )
  ) then
    raise exception 'Stored object MIME type cannot disagree with its evidence record.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_inspection_evidence_object_write()
  from public, anon, authenticated;

drop trigger if exists inspection_evidence_lock_open_inspection
  on storage.objects;
create trigger inspection_evidence_lock_open_inspection
before insert or update or delete on storage.objects
for each row execute function public.guard_inspection_evidence_object_write();

create or replace function public.assert_inspection_checklist_integrity(
  p_vehicle_type text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_count int;
  v_checkpoint_count int;
  v_active_count int;
  v_applicable_count int;
  v_conditional_count int;
  v_sections text;
  v_checkpoints text;
begin
  if p_vehicle_type not in ('motorcycle', 'scooter') then
    raise exception 'Unsupported inspection vehicle type.'
      using errcode = '23514';
  end if;

  select count(*) into v_section_count
  from public.inspection_sections;

  select count(*), count(*) filter (where c.is_active)
  into v_checkpoint_count, v_active_count
  from public.inspection_checkpoints c;

  if v_section_count <> 22 or v_checkpoint_count <> 260 or v_active_count <> 260 then
    raise exception 'Canonical checklist must contain 22 sections and 260 active checkpoints; found % sections, % checkpoints, % active.',
      v_section_count, v_checkpoint_count, v_active_count
      using errcode = '23514';
  end if;

  select
    count(*) filter (
      where c.active_for in ('both', p_vehicle_type)
        and not c.is_conditional
    ),
    count(*) filter (
      where c.active_for in ('both', p_vehicle_type)
        and c.is_conditional
    )
  into v_applicable_count, v_conditional_count
  from public.inspection_checkpoints c
  where c.is_active;

  if (p_vehicle_type = 'motorcycle' and
      (v_applicable_count <> 250 or v_conditional_count <> 4))
     or (p_vehicle_type = 'scooter' and
      (v_applicable_count <> 243 or v_conditional_count <> 5)) then
    raise exception 'Canonical checklist applicability counts are invalid for %.', p_vehicle_type
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.inspection_checkpoints
    where checkpoint_no = 115 and active_for = 'scooter' and is_active
  ) or not exists (
    select 1 from public.inspection_checkpoints
    where checkpoint_no = 125 and active_for = 'motorcycle' and is_active
  ) then
    raise exception 'Canonical vehicle-specific checkpoint applicability is invalid.'
      using errcode = '23514';
  end if;

  select string_agg(
    'S' || E'\t' || s.section_no::text || E'\t' || s.name,
    E'\n' order by s.section_no
  )
  into v_sections
  from public.inspection_sections s;

  select string_agg(
    concat_ws(
      E'\t',
      'C',
      c.checkpoint_no::text,
      c.section_no::text,
      c.name,
      c.classification,
      c.assessment_method,
      c.evidence_required,
      c.active_for,
      c.is_conditional::text,
      c.is_active::text
    ),
    E'\n' order by c.checkpoint_no
  )
  into v_checkpoints
  from public.inspection_checkpoints c;

  if md5(v_sections || E'\n' || v_checkpoints) <> 'a17a3650859f6f7553d4f05f4682d012' then
    raise exception 'Canonical inspection checklist metadata has drifted from the reviewed seed.'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.assert_inspection_checklist_integrity(text)
  from public, anon, authenticated;

create or replace function public.authorize_checkpoint_not_applicable(
  p_inspection_id uuid,
  p_checkpoint_no int,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_vehicle_type text;
begin
  if public.current_inspection_role() <> 'admin' then
    raise exception 'Only an active admin may authorize a conditional checkpoint as not applicable.'
      using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_reason, ''))) not between 10 and 500 then
    raise exception 'Authorization reason must contain 10 to 500 characters.'
      using errcode = '23514';
  end if;

  select i.status, v.vehicle_type
  into v_status, v_vehicle_type
  from public.inspections i
  join public.vehicles v on v.id = i.vehicle_id
  where i.id = p_inspection_id
  for update of i;

  if not found or v_status not in ('draft', 'in_progress') then
    raise exception 'Only an open inspection may receive an applicability authorization.'
      using errcode = '23514';
  end if;

  perform public.assert_inspection_checklist_integrity(v_vehicle_type);

  if not exists (
    select 1
    from public.inspection_checkpoints c
    join public.checkpoint_results r
      on r.inspection_id = p_inspection_id
     and r.checkpoint_no = c.checkpoint_no
    where c.checkpoint_no = p_checkpoint_no
      and c.is_active
      and c.is_conditional
      and c.active_for in ('both', v_vehicle_type)
      and r.applicable = false
      and r.result_status = 'not_applicable'
      and length(btrim(coalesce(r.applicability_reason, ''))) between 10 and 500
  ) then
    raise exception 'A saved not-applicable decision and inspector reason are required before authorization.'
      using errcode = '23514';
  end if;

  insert into public.inspection_applicability_authorizations (
    inspection_id,
    checkpoint_no,
    reason,
    authorized_by,
    authorized_at
  )
  values (
    p_inspection_id,
    p_checkpoint_no,
    btrim(p_reason),
    auth.uid(),
    now()
  )
  on conflict (inspection_id, checkpoint_no) do update
  set reason = excluded.reason,
      authorized_by = excluded.authorized_by,
      authorized_at = excluded.authorized_at;

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'inspection_checkpoint',
    p_inspection_id,
    'not_applicable_authorized',
    jsonb_build_object('checkpoint_no', p_checkpoint_no, 'reason', btrim(p_reason))
  );
end;
$$;

revoke all on function public.authorize_checkpoint_not_applicable(uuid, int, text)
  from public, anon;
grant execute on function public.authorize_checkpoint_not_applicable(uuid, int, text)
  to authenticated;

create or replace function public.assign_repair_job(
  p_repair_job_id uuid,
  p_mechanic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection_id uuid;
  v_inspection_status text;
begin
  if public.current_inspection_role() <> 'admin' then
    raise exception 'Only an active admin may assign repair work.'
      using errcode = '42501';
  end if;

  select i.id, i.status
  into v_inspection_id, v_inspection_status
  from public.repair_jobs j
  join public.inspections i on i.id = j.inspection_id
  where j.id = p_repair_job_id
  for update of i, j;

  if not found or v_inspection_status <> 'repair_required' then
    raise exception 'Repair assignment requires an inspection awaiting repair.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_mechanic_id
      and p.role = 'mechanic'
      and p.is_active
  ) then
    raise exception 'The assigned profile must be an active mechanic.'
      using errcode = '23514';
  end if;

  update public.repair_jobs
  set assigned_mechanic_id = p_mechanic_id,
      status = 'assigned'
  where id = p_repair_job_id
    and status in ('pending', 'assigned');

  if not found then
    raise exception 'Only pending or assigned repair jobs can be assigned.'
      using errcode = '23514';
  end if;

  insert into public.repair_updates (
    repair_job_id, updated_by, status, note
  )
  values (
    p_repair_job_id, auth.uid(), 'assigned', 'Repair job assigned to mechanic.'
  );

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'repair_job',
    p_repair_job_id,
    'assigned',
    jsonb_build_object('inspection_id', v_inspection_id, 'mechanic_id', p_mechanic_id)
  );
end;
$$;

revoke all on function public.assign_repair_job(uuid, uuid) from public, anon;
grant execute on function public.assign_repair_job(uuid, uuid) to authenticated;

create or replace function public.complete_repair_job(
  p_repair_job_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection_id uuid;
  v_inspection_status text;
  v_job_status text;
  v_mechanic_id uuid;
begin
  if public.current_inspection_role() <> 'mechanic' then
    raise exception 'Only an active mechanic may complete assigned repair work.'
      using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_note, ''))) not between 10 and 2000 then
    raise exception 'Repair completion notes must contain 10 to 2000 characters.'
      using errcode = '23514';
  end if;

  select i.id, i.status, j.status, j.assigned_mechanic_id
  into v_inspection_id, v_inspection_status, v_job_status, v_mechanic_id
  from public.repair_jobs j
  join public.inspections i on i.id = j.inspection_id
  where j.id = p_repair_job_id
  for update of i, j;

  if not found
     or v_inspection_status <> 'repair_required'
     or v_mechanic_id is distinct from auth.uid()
     or v_job_status not in ('assigned', 'in_progress') then
    raise exception 'Only the assigned mechanic may complete an open repair job.'
      using errcode = '42501';
  end if;

  update public.repair_jobs
  set status = 'completed',
      completed_at = now()
  where id = p_repair_job_id;

  insert into public.repair_updates (
    repair_job_id, updated_by, status, note
  )
  values (
    p_repair_job_id, auth.uid(), 'completed', btrim(p_note)
  );

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'repair_job',
    p_repair_job_id,
    'completed',
    jsonb_build_object('inspection_id', v_inspection_id, 'note', btrim(p_note))
  );
end;
$$;

revoke all on function public.complete_repair_job(uuid, text) from public, anon;
grant execute on function public.complete_repair_job(uuid, text) to authenticated;

create or replace function public.verify_repair_job(
  p_repair_job_id uuid,
  p_approved boolean,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection_id uuid;
  v_inspection_status text;
  v_job_status text;
begin
  if public.current_inspection_role() not in ('admin', 'quality_controller') then
    raise exception 'Only an active quality controller or admin may verify repair work.'
      using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_notes, ''))) not between 5 and 2000 then
    raise exception 'Repair verification notes must contain 5 to 2000 characters.'
      using errcode = '23514';
  end if;

  select i.id, i.status, j.status
  into v_inspection_id, v_inspection_status, v_job_status
  from public.repair_jobs j
  join public.inspections i on i.id = j.inspection_id
  where j.id = p_repair_job_id
  for update of i, j;

  if not found
     or v_inspection_status <> 'repair_required'
     or v_job_status <> 'completed' then
    raise exception 'Only completed repairs on an inspection awaiting repair may be verified.'
      using errcode = '23514';
  end if;

  update public.repair_jobs
  set status = case when p_approved then 'verified' else 'assigned' end,
      completed_at = case when p_approved then completed_at else null end
  where id = p_repair_job_id;

  insert into public.quality_reviews (
    inspection_id,
    reviewer_id,
    review_type,
    status,
    critical_variance_count,
    notes
  )
  values (
    v_inspection_id,
    auth.uid(),
    'repair_verification',
    case when p_approved then 'approved' else 'rejected' end,
    case when p_approved then 0 else 1 end,
    btrim(p_notes)
  );

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'repair_job',
    p_repair_job_id,
    case when p_approved then 'repair_verified' else 'repair_rejected' end,
    jsonb_build_object('inspection_id', v_inspection_id, 'notes', btrim(p_notes))
  );
end;
$$;

revoke all on function public.verify_repair_job(uuid, boolean, text) from public, anon;
grant execute on function public.verify_repair_job(uuid, boolean, text) to authenticated;

create or replace function public.start_reinspection(p_inspection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent public.inspections%rowtype;
  v_reinspection_id uuid;
begin
  if public.current_inspection_role() not in ('admin', 'inspector') then
    raise exception 'An active inspector or admin profile is required to start reinspection.'
      using errcode = '42501';
  end if;

  select i.*
  into v_parent
  from public.inspections i
  where i.id = p_inspection_id
    and (i.inspector_id = auth.uid() or public.current_inspection_role() = 'admin')
  for update;

  if not found or v_parent.status <> 'repair_required' then
    raise exception 'Only an authorized inspection awaiting repair can be reinspected.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.repair_jobs j
    where j.inspection_id = v_parent.id
  ) or exists (
    select 1
    from public.repair_jobs j
    where j.inspection_id = v_parent.id
      and j.status <> 'verified'
  ) then
    raise exception 'Every repair job must be independently verified before reinspection.'
      using errcode = '23514';
  end if;

  select i.id into v_reinspection_id
  from public.inspections i
  where i.reinspection_of = v_parent.id
    and i.status in ('draft', 'in_progress')
    and i.inspector_id = auth.uid();

  if found then
    return v_reinspection_id;
  end if;

  if exists (
    select 1 from public.inspections i
    where i.reinspection_of = v_parent.id
  ) then
    raise exception 'A reinspection already exists for this repair cycle.'
      using errcode = '23505';
  end if;

  insert into public.inspections (
    vehicle_id, inspector_id, status, reinspection_of
  )
  values (
    v_parent.vehicle_id, auth.uid(), 'draft', v_parent.id
  )
  returning id into v_reinspection_id;

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'inspection',
    v_reinspection_id,
    'reinspection_started',
    jsonb_build_object('reinspection_of', v_parent.id)
  );

  return v_reinspection_id;
end;
$$;

revoke all on function public.start_reinspection(uuid) from public, anon;
grant execute on function public.start_reinspection(uuid) to authenticated;

create or replace function public.finalize_quality_review(
  p_inspection_id uuid,
  p_approved boolean,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection public.inspections%rowtype;
  v_parent_status text;
  v_rating public.vehicle_ratings%rowtype;
begin
  if public.current_inspection_role() not in ('admin', 'quality_controller') then
    raise exception 'Only an active quality controller or admin may finalize quality review.'
      using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_notes, ''))) not between 5 and 2000 then
    raise exception 'Quality review notes must contain 5 to 2000 characters.'
      using errcode = '23514';
  end if;

  select i.* into v_inspection
  from public.inspections i
  where i.id = p_inspection_id
  for update;

  if not found or v_inspection.status not in ('submitted', 'qc_pending') then
    raise exception 'Only a submitted inspection may receive final quality review.'
      using errcode = '23514';
  end if;

  select vr.* into v_rating
  from public.vehicle_ratings vr
  where vr.inspection_id = p_inspection_id
  for update;

  if not found then
    raise exception 'A persisted inspection rating is required for quality review.'
      using errcode = '23514';
  end if;

  if p_approved and (
    v_rating.safety_clearance <> 'cleared'
    or v_rating.critical_failures <> 0
  ) then
    raise exception 'Quality approval is blocked by unresolved critical safety failures.'
      using errcode = '23514';
  end if;

  if p_approved and v_inspection.reinspection_of is not null then
    select i.status into v_parent_status
    from public.inspections i
    where i.id = v_inspection.reinspection_of
    for update;

    if not found
       or v_parent_status <> 'repair_required'
       or not exists (
         select 1 from public.repair_jobs j
         where j.inspection_id = v_inspection.reinspection_of
       )
       or exists (
         select 1 from public.repair_jobs j
         where j.inspection_id = v_inspection.reinspection_of
           and j.status <> 'verified'
       ) then
      raise exception 'Reinspection approval requires all original repair jobs to be verified.'
        using errcode = '23514';
    end if;
  end if;

  insert into public.quality_reviews (
    inspection_id,
    reviewer_id,
    review_type,
    status,
    critical_variance_count,
    notes
  )
  values (
    p_inspection_id,
    auth.uid(),
    'final_approval',
    case when p_approved then 'approved' else 'rejected' end,
    case when p_approved then 0 else 1 end,
    btrim(p_notes)
  );

  update public.inspections
  set status = case when p_approved then 'approved' else 'rejected' end
  where id = p_inspection_id;

  if p_approved then
    update public.vehicle_ratings
    set sale_ready = true,
        calculated_at = now()
    where inspection_id = p_inspection_id;
  end if;

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'inspection',
    p_inspection_id,
    case when p_approved then 'quality_approved' else 'quality_rejected' end,
    jsonb_build_object('notes', btrim(p_notes))
  );
end;
$$;

revoke all on function public.finalize_quality_review(uuid, boolean, text) from public, anon;
grant execute on function public.finalize_quality_review(uuid, boolean, text) to authenticated;

create or replace function public.submit_inspection(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_role text;
  v_inspection public.inspections%rowtype;
  v_vehicle_type text;
  v_unresolved int;
  v_incomplete int;
  v_total_applicable int;
  v_critical_failures int;
  v_cosmetic_score numeric;
  v_safety_clearance text;
  v_completed_at timestamptz;
begin
  v_role := public.current_inspection_role();
  if v_role is null or v_role not in ('admin', 'inspector') then
    raise exception 'An active inspector or admin profile is required.'
      using errcode = '42501';
  end if;

  select i.*
  into v_inspection
  from public.inspections i
  where i.id = p_inspection_id
    and (i.inspector_id = auth.uid() or v_role = 'admin')
  for update;

  if not found then
    raise exception 'Inspection not found or access denied.'
      using errcode = '42501';
  end if;

  select v.vehicle_type
  into v_vehicle_type
  from public.vehicles v
  where v.id = v_inspection.vehicle_id;

  perform public.assert_inspection_checklist_integrity(v_vehicle_type);

  if v_inspection.status in ('submitted', 'repair_required', 'approved', 'rejected') then
    return (
      select jsonb_build_object(
        'inspection_id', v_inspection.id,
        'status', v_inspection.status,
        'total_applicable', (v_inspection.progress ->> 'applicable')::int,
        'critical_failures', vr.critical_failures,
        'cosmetic_score', vr.cosmetic_score,
        'safety_clearance', vr.safety_clearance,
        'sale_ready', vr.sale_ready,
        'completed_at', v_inspection.completed_at
      )
      from public.vehicle_ratings vr
      where vr.inspection_id = v_inspection.id
    );
  end if;

  if v_inspection.status not in ('draft', 'in_progress') then
    raise exception 'This inspection cannot be submitted from its current status.'
      using errcode = '23514';
  end if;

  select count(*) into v_unresolved
  from public.inspection_checkpoints c
  left join public.checkpoint_results r
    on r.inspection_id = v_inspection.id
    and r.checkpoint_no = c.checkpoint_no
  where c.is_active
    and (c.active_for = 'both' or c.active_for = v_vehicle_type)
    and c.is_conditional
    and (
      r.id is null
      or r.applicable is null
      or (
        r.applicable = false
        and (
          r.result_status is distinct from 'not_applicable'
          or length(btrim(coalesce(r.applicability_reason, ''))) not between 10 and 500
          or not exists (
            select 1
            from public.inspection_applicability_authorizations a
            where a.inspection_id = v_inspection.id
              and a.checkpoint_no = c.checkpoint_no
          )
        )
      )
    );

  if v_unresolved > 0 then
    raise exception 'Submission blocked: % conditional applicability decision(s) remain unresolved.', v_unresolved
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.checkpoint_results r
    join public.inspection_checkpoints c on c.checkpoint_no = r.checkpoint_no
    where r.inspection_id = v_inspection.id
      and (
        not c.is_active
        or (c.active_for not in ('both', v_vehicle_type))
        or (not c.is_conditional and r.applicable is distinct from true)
      )
  ) then
    raise exception 'Submission blocked: checkpoint applicability data is inconsistent.'
      using errcode = '23514';
  end if;

  select count(*) into v_incomplete
  from public.inspection_checkpoints c
  left join public.checkpoint_results r
    on r.inspection_id = v_inspection.id
    and r.checkpoint_no = c.checkpoint_no
  where c.is_active
    and (c.active_for = 'both' or c.active_for = v_vehicle_type)
    and (not c.is_conditional or r.applicable = true)
    and (
      r.id is null
      or case
        when c.is_conditional and r.applicable = false then
          r.result_status = 'not_applicable'
        when c.assessment_method like '1–5 scale +%' then
          r.cosmetic_score between 1 and 5
          and r.result_status in ('pass', 'fail')
        when c.assessment_method like '1–5 scale%' then
          r.cosmetic_score between 1 and 5
        when c.assessment_method in ('Measured vs spec', 'Age vs threshold', 'Pass/Fail (wear threshold)') then
          r.measured_value is not null
          and nullif(btrim(r.measured_unit), '') is not null
          and nullif(btrim(r.expected_value), '') is not null
          and r.result_status in ('pass', 'fail')
        when c.assessment_method = 'Measured' then
          r.measured_value is not null
          and nullif(btrim(r.measured_unit), '') is not null
        when c.assessment_method = 'Recorded' then
          nullif(btrim(r.recorded_value), '') is not null
        when c.assessment_method = 'Disclosed / Undisclosed' then
          r.is_disclosed is not null
        when c.assessment_method = 'Present/Absent' then
          r.recorded_value in ('Present', 'Absent')
        when c.assessment_method = 'Match + tamper check' then
          r.match_status in ('match', 'mismatch')
          and r.result_status in ('pass', 'fail')
        when c.assessment_method like '%Match%' then
          r.match_status in ('match', 'mismatch')
        when lower(c.assessment_method) like '%count logged%' then
          r.result_status in ('pass', 'fail')
          and nullif(btrim(r.count_value), '') is not null
          and r.count_value ~ '^[0-9]+([.][0-9]+)?$'
        when c.assessment_method like 'Auto-%' then
          nullif(btrim(r.auto_value), '') is not null
        when c.assessment_method like '%Pass/Fail%' or c.assessment_method = 'Tamper check' then
          r.result_status in ('pass', 'fail')
        else
          nullif(btrim(r.recorded_value), '') is not null
      end is not true
      or (
        c.evidence_required = 'Photo'
        and not exists (
          select 1
          from public.evidence e
          join storage.objects o
            on o.bucket_id = 'inspection-evidence'
            and o.name = e.storage_path
          where e.checkpoint_result_id = r.id
            and e.media_type = 'photo'
            and lower(coalesce(o.metadata ->> 'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
            and (storage.foldername(e.storage_path))[1] = r.inspection_id::text
            and (storage.foldername(e.storage_path))[2] = r.checkpoint_no::text
        )
      )
      or (
        c.evidence_required = 'Video'
        and not exists (
          select 1
          from public.evidence e
          join storage.objects o
            on o.bucket_id = 'inspection-evidence'
            and o.name = e.storage_path
          where e.checkpoint_result_id = r.id
            and e.media_type = 'video'
            and lower(coalesce(o.metadata ->> 'mimetype', '')) in ('video/mp4', 'video/quicktime', 'video/webm')
            and (storage.foldername(e.storage_path))[1] = r.inspection_id::text
            and (storage.foldername(e.storage_path))[2] = r.checkpoint_no::text
        )
      )
      or (
        c.evidence_required = 'Photo+Video'
        and (
          not exists (
            select 1
            from public.evidence e
            join storage.objects o
              on o.bucket_id = 'inspection-evidence'
              and o.name = e.storage_path
            where e.checkpoint_result_id = r.id
              and e.media_type = 'photo'
              and lower(coalesce(o.metadata ->> 'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
              and (storage.foldername(e.storage_path))[1] = r.inspection_id::text
              and (storage.foldername(e.storage_path))[2] = r.checkpoint_no::text
          )
          or not exists (
            select 1
            from public.evidence e
            join storage.objects o
              on o.bucket_id = 'inspection-evidence'
              and o.name = e.storage_path
            where e.checkpoint_result_id = r.id
              and e.media_type = 'video'
              and lower(coalesce(o.metadata ->> 'mimetype', '')) in ('video/mp4', 'video/quicktime', 'video/webm')
              and (storage.foldername(e.storage_path))[1] = r.inspection_id::text
              and (storage.foldername(e.storage_path))[2] = r.checkpoint_no::text
          )
        )
      )
    );

  if v_incomplete > 0 then
    raise exception 'Submission blocked: % applicable checkpoint(s) lack a complete assessment or required evidence.', v_incomplete
      using errcode = '23514';
  end if;

  select count(*) into v_total_applicable
  from public.inspection_checkpoints c
  left join public.checkpoint_results r
    on r.inspection_id = v_inspection.id
    and r.checkpoint_no = c.checkpoint_no
  where c.is_active
    and (c.active_for = 'both' or c.active_for = v_vehicle_type)
    and (not c.is_conditional or r.applicable = true);

  select count(*) into v_critical_failures
  from public.checkpoint_results r
  join public.inspection_checkpoints c on c.checkpoint_no = r.checkpoint_no
  where r.inspection_id = v_inspection.id
    and (not c.is_conditional or r.applicable = true)
    and c.classification in ('Critical', 'Mixed')
    and (
      r.result_status = 'fail'
      or r.match_status = 'mismatch'
      or (c.assessment_method = 'Present/Absent' and r.recorded_value = 'Absent')
    );

  select round(avg(r.cosmetic_score)::numeric, 2) into v_cosmetic_score
  from public.checkpoint_results r
  join public.inspection_checkpoints c on c.checkpoint_no = r.checkpoint_no
  where r.inspection_id = v_inspection.id
    and (not c.is_conditional or r.applicable = true)
    and c.classification in ('Cosmetic', 'Mixed')
    and r.cosmetic_score is not null;

  v_safety_clearance := case
    when v_critical_failures > 0 then 'blocked'
    else 'cleared'
  end;
  v_completed_at := now();

  update public.inspections
  set status = case
        when v_critical_failures > 0 then 'repair_required'
        else 'submitted'
      end,
      submitted_at = v_completed_at,
      completed_at = v_completed_at,
      progress = jsonb_build_object(
        'applicable', v_total_applicable,
        'completed', v_total_applicable,
        'pending', 0,
        'critical_failures', v_critical_failures
      )
  where id = v_inspection.id;

  insert into public.vehicle_ratings (
    inspection_id,
    cosmetic_score,
    critical_failures,
    safety_clearance,
    sale_ready
  )
  values (
    v_inspection.id,
    v_cosmetic_score,
    v_critical_failures,
    v_safety_clearance,
    false
  )
  on conflict (inspection_id) do update set
    cosmetic_score = excluded.cosmetic_score,
    critical_failures = excluded.critical_failures,
    safety_clearance = excluded.safety_clearance,
    sale_ready = false,
    calculated_at = now();

  if v_critical_failures > 0 then
    insert into public.repair_jobs (
      inspection_id,
      checkpoint_result_id,
      title,
      description,
      priority,
      status
    )
    select
      r.inspection_id,
      r.id,
      c.name,
      nullif(btrim(coalesce(r.issue_description, r.observation, '')), ''),
      'critical',
      'pending'
    from public.checkpoint_results r
    join public.inspection_checkpoints c on c.checkpoint_no = r.checkpoint_no
    where r.inspection_id = v_inspection.id
      and c.classification in ('Critical', 'Mixed')
      and (not c.is_conditional or r.applicable = true)
      and (
        r.result_status = 'fail'
        or r.match_status = 'mismatch'
        or (c.assessment_method = 'Present/Absent' and r.recorded_value = 'Absent')
      )
    on conflict (checkpoint_result_id) where checkpoint_result_id is not null
    do nothing;
  end if;

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'inspection',
    v_inspection.id,
    case when v_critical_failures > 0 then 'submitted_repair_required' else 'submitted' end,
    jsonb_build_object(
      'status', case when v_critical_failures > 0 then 'repair_required' else 'submitted' end,
      'applicable', v_total_applicable,
      'critical_failures', v_critical_failures
    )
  );

  return jsonb_build_object(
    'inspection_id', v_inspection.id,
    'status', case when v_critical_failures > 0 then 'repair_required' else 'submitted' end,
    'total_applicable', v_total_applicable,
    'critical_failures', v_critical_failures,
    'cosmetic_score', v_cosmetic_score,
    'safety_clearance', v_safety_clearance,
    'sale_ready', false,
    'completed_at', v_completed_at
  );
end;
$$;

revoke all on function public.submit_inspection(uuid) from public, anon;
grant execute on function public.submit_inspection(uuid) to authenticated;
