-- Permit every active workshop role to conduct and submit their own inspection.
-- Existing global one-open-inspection-per-vehicle constraint remains unchanged.

drop policy if exists profiles_read_self_and_workshop_staff on public.profiles;
create policy profiles_read_self_and_workshop_staff
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (
    public.current_inspection_role() in (
      'admin', 'inspector', 'mechanic', 'quality_controller'
    )
    and is_active
    and (
      role = 'mechanic'
      or (
        public.current_inspection_role() in ('admin', 'inspector')
        and role = 'inspector'
      )
    )
  )
);

drop policy if exists inspections_insert_self on public.inspections;
create policy inspections_insert_self
on public.inspections for insert to authenticated
with check (
  inspector_id = auth.uid()
  and public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
  and status in ('draft', 'in_progress')
);

drop policy if exists inspections_update_open_owner_or_admin on public.inspections;
create policy inspections_update_open_owner_or_admin
on public.inspections for update to authenticated
using (
  public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
  and (inspector_id = auth.uid() or public.current_inspection_role() = 'admin')
  and status in ('draft', 'in_progress')
)
with check (
  public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
  and public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
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
  public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
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
  and public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
  and exists (
    select 1
    from public.inspections i
    where i.id = checkpoint_results.inspection_id
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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

drop policy if exists evidence_read_owner_or_admin on public.evidence;
create policy evidence_read_owner_or_admin
on public.evidence for select to authenticated
using (
  exists (
    select 1
    from public.checkpoint_results r
    join public.inspections i on i.id = r.inspection_id
    where r.id = evidence.checkpoint_result_id
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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

drop policy if exists evidence_delete_open_owner on public.evidence;
create policy evidence_delete_open_owner
on public.evidence for delete to authenticated
using (
  exists (
    select 1
    from public.checkpoint_results r
    join public.inspections i on i.id = r.inspection_id
    where r.id = evidence.checkpoint_result_id
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

drop policy if exists applicability_authorizations_read_owner_or_admin
  on public.inspection_applicability_authorizations;
create policy applicability_authorizations_read_owner_or_admin
on public.inspection_applicability_authorizations for select to authenticated
using (
  public.current_inspection_role() in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
      and i.inspector_id = auth.uid()
      and i.status in ('draft', 'in_progress')
  )
);

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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
      and public.current_inspection_role() in (
        'admin', 'inspector', 'mechanic', 'quality_controller'
      )
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
     or public.current_inspection_role() not in (
       'admin', 'inspector', 'mechanic', 'quality_controller'
     )
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
     or public.current_inspection_role() not in (
       'admin', 'inspector', 'mechanic', 'quality_controller'
     )
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
     or public.current_inspection_role() not in (
       'admin', 'inspector', 'mechanic', 'quality_controller'
     )
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
  if public.current_inspection_role() not in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  ) then
    raise exception 'An active workshop staff profile is required to start reinspection.'
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
  if v_role is null or v_role not in (
    'admin', 'inspector', 'mechanic', 'quality_controller'
  ) then
    raise exception 'An active workshop staff profile is required.'
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
