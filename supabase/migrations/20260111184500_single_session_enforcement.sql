-- Enforce Single Active Session Per User
-- This function runs every time a new session is created.
-- It deletes all *other* sessions for the same user, ensuring only the latest one remains active.

-- Function to handle new session creation
create or replace function public.handle_new_session()
returns trigger as $$
begin
  -- Delete all other sessions for this user, excluding the one just created (NEW.id)
  -- We access auth.sessions directly.
  -- SECURITY DEFINER is required to allow this function to modify auth schema
  delete from auth.sessions
  where user_id = new.user_id
  and id <> new.id;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition
-- We use 'after insert' to ensure the new session is successfully created first
drop trigger if exists on_auth_session_created on auth.sessions;

create trigger on_auth_session_created
  after insert on auth.sessions
  for each row execute procedure public.handle_new_session();
