drop policy if exists vehicles_insert_staff on public.vehicles;

create policy vehicles_insert_staff
on public.vehicles for insert to authenticated
with check (
  public.current_inspection_role() in (
    'admin',
    'inspector',
    'mechanic',
    'quality_controller'
  )
  and created_by = auth.uid()
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
