drop policy if exists processes_read on public.processes;

create policy processes_read on public.processes for select to authenticated
using (
  public.is_org_admin(organization_id)
  or (
    public.is_org_member(organization_id)
    and status = 'approved'
    and (
      not exists (
        select 1
        from public.process_role_assignments pra
        where pra.process_id = processes.id
      )
      or exists (
        select 1
        from public.process_role_assignments pra
        join public.organization_members om on om.role_id = pra.role_id
        where pra.process_id = processes.id
          and om.user_id = (select auth.uid())
          and om.organization_id = processes.organization_id
      )
      or exists (
        select 1
        from public.training_assignments training
        where training.process_id = processes.id
          and training.organization_id = processes.organization_id
          and training.user_id = (select auth.uid())
      )
    )
  )
);

comment on policy processes_read on public.processes is
  'Members may read approved public-to-workspace, role-assigned, or directly assigned training processes.';
