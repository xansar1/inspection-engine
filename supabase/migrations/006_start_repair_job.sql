create or replace function public.start_repair_job(
  p_repair_job_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_inspection_id uuid;
  v_inspection_status text;
  v_job_status text;
  v_mechanic_id uuid;
begin
  if public.current_inspection_role() <> 'mechanic' then
    raise exception 'Only an active mechanic may start repair work.'
      using errcode = '42501';
  end if;

  select
    i.id,
    i.status,
    j.status,
    j.assigned_mechanic_id
  into
    v_inspection_id,
    v_inspection_status,
    v_job_status,
    v_mechanic_id
  from public.repair_jobs j
  join public.inspections i on i.id = j.inspection_id
  where j.id = p_repair_job_id
  for update of i, j;

  if not found
     or v_inspection_status is distinct from 'repair_required'
     or v_mechanic_id is distinct from auth.uid()
     or v_job_status is distinct from 'assigned' then
    raise exception 'Only the assigned mechanic may start an assigned repair job.'
      using errcode = '42501';
  end if;

  update public.repair_jobs
  set status = 'in_progress'
  where id = p_repair_job_id;

  insert into public.repair_updates (
    repair_job_id, updated_by, status, note
  )
  values (
    p_repair_job_id, auth.uid(), 'in_progress', 'Repair work started.'
  );

  insert into public.audit_logs (
    actor_id, entity_type, entity_id, action, after_data
  )
  values (
    auth.uid(),
    'repair_job',
    p_repair_job_id,
    'started',
    jsonb_build_object(
      'inspection_id', v_inspection_id,
      'status', 'in_progress'
    )
  );
end;
$function$;

revoke all on function public.start_repair_job(uuid)
from public, anon;

grant execute on function public.start_repair_job(uuid)
to authenticated;