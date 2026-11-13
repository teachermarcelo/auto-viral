create or replace function public.av_set_kiwify_webhook_token(p_workspace_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare secret_name text := 'av_kiwify_webhook_token_' || p_workspace_id::text; existing_id uuid; token_hash text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(coalesce(p_token,'')) < 20 or length(p_token)>256 then raise exception 'Token inválido'; end if;
 if not exists(select 1 from public.av_workspace_members m where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.role in ('owner','admin')) then raise exception 'Workspace owner/admin access required'; end if;
 token_hash:=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 select id into existing_id from vault.secrets where name=secret_name limit 1;
 if existing_id is null then perform vault.create_secret(p_token,secret_name,'Kiwify webhook HMAC token for AutoViral',null);
 else perform vault.update_secret(existing_id,p_token,secret_name,'Kiwify webhook HMAC token for AutoViral',null); end if;
 update public.av_kiwify_webhook_secrets set active=false where workspace_id=p_workspace_id;
 insert into public.av_kiwify_webhook_secrets(workspace_id,token_hash,active) values(p_workspace_id,token_hash,true)
 on conflict(token_hash) do update set workspace_id=excluded.workspace_id,active=true;
 return jsonb_build_object('ok',true,'message','Token Kiwify salvo com segurança.');
end; $$;
revoke all on function public.av_set_kiwify_webhook_token(uuid,text) from public,anon;
grant execute on function public.av_set_kiwify_webhook_token(uuid,text) to authenticated;
create or replace function public.av_verify_kiwify_webhook(p_signature text,p_raw_body text,p_canonical_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare item record; expected text; signature text:=lower(coalesce(p_signature,''));
begin
 if length(signature)<>40 or signature !~ '^[0-9a-f]{40}$' then return null; end if;
 for item in select s.workspace_id,v.decrypted_secret from public.av_kiwify_webhook_secrets s join vault.decrypted_secrets v on v.name=('av_kiwify_webhook_token_'||s.workspace_id::text) where s.active=true loop
  expected:=encode(extensions.hmac(convert_to(coalesce(p_raw_body,''),'UTF8'),convert_to(item.decrypted_secret,'UTF8'),'sha1'),'hex');
  if expected=signature then return item.workspace_id; end if;
  expected:=encode(extensions.hmac(convert_to(coalesce(p_canonical_body,''),'UTF8'),convert_to(item.decrypted_secret,'UTF8'),'sha1'),'hex');
  if expected=signature then return item.workspace_id; end if;
 end loop;
 return null;
end; $$;
revoke all on function public.av_verify_kiwify_webhook(text,text,text) from public,anon,authenticated;
grant execute on function public.av_verify_kiwify_webhook(text,text,text) to service_role;