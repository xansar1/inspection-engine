
-- Allow all active workshop staff to view all registered vehicles.
-- Existing vehicle records and inspection history remain unchanged.

drop policy if exists vehicles_read_staff
on public.vehicles;

create policy vehicles_read_staff
on public.vehicles
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
