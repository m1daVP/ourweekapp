-- The API uses backend service-role calls for every application RPC.
-- Supabase grants EXECUTE on new functions to PUBLIC, anon, and
-- authenticated by default, so remove those grants for all existing and
-- future public functions.

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

