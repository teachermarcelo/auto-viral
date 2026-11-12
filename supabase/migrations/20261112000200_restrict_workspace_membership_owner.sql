-- Tighten workspace membership administration: only owners may change membership or remove members.
create or replace function private.av_is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.av_workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke all on function private.av_is_workspace_owner(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.av_is_workspace_owner(uuid) to authenticated;

drop policy if exists av_members_update_admin on public.av_workspace_members;
drop policy if exists av_members_delete_admin on public.av_workspace_members;
drop policy if exists av_members_update_owner on public.av_workspace_members;
drop policy if exists av_members_delete_owner on public.av_workspace_members;

create policy av_members_update_owner on public.av_workspace_members for update to authenticated
  using ((select private.av_is_workspace_owner(workspace_id)))
  with check ((select private.av_is_workspace_owner(workspace_id)));
create policy av_members_delete_owner on public.av_workspace_members for delete to authenticated
  using ((select private.av_is_workspace_owner(workspace_id)) and user_id <> (select auth.uid()));
