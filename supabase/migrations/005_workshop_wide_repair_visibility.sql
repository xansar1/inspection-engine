
-- Allow all active workshop staff to view all repair jobs.
-- This changes visibility only, not repair update permissions.

drop policy if exists repair_jobs_read_owner_or_admin
on public.repair_jobs;

create policy repair_jobs_read_owner_or_admin
on public.repair_jobs
for select
to authenticated
using (
  public.current_inspection_role() in (
    'admin',
    'inspector',
    'mechanic',
    'quality_controller'
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in (
        'admin',
        'inspector',
        'mechanic',
        'quality_controller'
      )
  )
);
