-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    service_key TEXT;
    base_url TEXT;
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Get secrets
    SELECT service_role_key, edge_function_base_url 
    INTO service_key, base_url
    FROM public.app_secrets
    WHERE id = 'default';

    -- If secrets are missing, log error and exit (don't fail the registration)
    IF service_key IS NULL OR base_url IS NULL THEN
        RAISE WARNING 'Registration Trigger: Missing app_secrets (service_role_key or edge_function_base_url). Email not sent.';
        RETURN NEW;
    END IF;

    user_email := NEW.email;
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');

    -- Call send-email Edge Function
    -- Endpoint: /send-email
    -- Usage of net.http_post (from pg_net extension)
    PERFORM net.http_post(
        url := base_url || '/send-email',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
            'to', user_email,
            'template', 'registration',
            'data', jsonb_build_object(
                'name', user_name
            )
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent blocking registration on error
    RAISE WARNING 'Registration Trigger Error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;
CREATE TRIGGER on_auth_user_created_send_email
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
