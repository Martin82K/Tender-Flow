-- Disposable regression probe for PostgreSQL's FK trigger execution identity.
-- No public table, policy or function is changed.
BEGIN;
CREATE TEMP TABLE tf_test_contract(id int PRIMARY KEY,source_bid_id int);
CREATE TEMP TABLE tf_test_category(id int PRIMARY KEY);
CREATE TEMP TABLE tf_test_bid(id int PRIMARY KEY,category_id int REFERENCES tf_test_category(id) ON DELETE CASCADE);
CREATE TEMP TABLE tf_test_link(bid_id int REFERENCES tf_test_bid(id) ON DELETE CASCADE,contract_id int REFERENCES tf_test_contract(id) ON DELETE CASCADE);
CREATE TEMP TABLE tf_test_log(who text);
INSERT INTO tf_test_contract VALUES(1,1),(2,2);
INSERT INTO tf_test_category VALUES(1),(2);
INSERT INTO tf_test_bid VALUES(1,1),(2,2);
INSERT INTO tf_test_link VALUES(1,1),(2,2);
ALTER TABLE tf_test_contract ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_c ON tf_test_contract FOR SELECT TO authenticated USING(true);
GRANT SELECT,UPDATE ON tf_test_contract TO authenticated;
GRANT SELECT,DELETE ON tf_test_bid,tf_test_link,tf_test_category TO authenticated;
GRANT INSERT,SELECT ON tf_test_log TO authenticated;
CREATE FUNCTION pg_temp.tf_test_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE touched int;
BEGIN
  INSERT INTO pg_temp.tf_test_log VALUES(current_user);
  UPDATE pg_temp.tf_test_contract SET source_bid_id=NULL WHERE id=OLD.contract_id RETURNING id INTO touched;
  IF touched IS NULL THEN RAISE EXCEPTION 'not writable' USING ERRCODE='42501'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER tf_test_guard BEFORE DELETE ON tf_test_link FOR EACH ROW EXECUTE FUNCTION pg_temp.tf_test_guard();
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    DELETE FROM pg_temp.tf_test_link WHERE bid_id=1;
    RAISE EXCEPTION 'direct unlink bypassed contract permissions';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DELETE FROM pg_temp.tf_test_bid WHERE id=1;
DELETE FROM pg_temp.tf_test_category WHERE id=2;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM tf_test_link) THEN RAISE EXCEPTION 'cascade failed'; END IF;
  IF EXISTS(SELECT 1 FROM tf_test_contract WHERE source_bid_id IS NOT NULL) THEN RAISE EXCEPTION 'provenance not cleared'; END IF;
  IF EXISTS(SELECT 1 FROM tf_test_log WHERE who='authenticated') THEN RAISE EXCEPTION 'unexpected FK identity'; END IF;
END $$;
SELECT 'bid/category cascades clear provenance; direct unlink denied without contract edit' AS result;
ROLLBACK;
