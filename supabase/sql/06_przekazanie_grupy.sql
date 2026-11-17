-- Rytm: przekazanie grupy innej osobie.
-- Zasada „grupa: zmiana” pozwala założycielowi zmieniać grupę, ale nie oddać jej (sprawdza created_by = auth.uid() po zmianie),
-- więc przekazanie robi ta funkcja: tylko obecny założyciel, tylko osobie, która jest w grupie.
create or replace function public.rytm_transfer_group(p_group uuid, p_to uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Nie zalogowano'; end if;
  if not exists (select 1 from public.rytm_group where id = p_group and created_by = (select auth.uid())) then
    raise exception 'Tylko założyciel może przekazać grupę';
  end if;
  if p_to is null or p_to = (select auth.uid()) or not exists (select 1 from public.rytm_member where group_id = p_group and user_id = p_to) then
    raise exception 'Tej osoby nie ma w grupie';
  end if;
  update public.rytm_group set created_by = p_to where id = p_group;
  update public.rytm_member set role = case when user_id = p_to then 'owner' else 'member' end
    where group_id = p_group and user_id in (p_to, (select auth.uid()));
end $$;

revoke execute on function public.rytm_transfer_group(uuid, uuid) from public, anon;
grant execute on function public.rytm_transfer_group(uuid, uuid) to authenticated;
