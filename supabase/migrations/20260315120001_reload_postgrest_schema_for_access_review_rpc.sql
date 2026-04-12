DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;
