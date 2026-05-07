CREATE TABLE IF NOT EXISTS narrative_edits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id text NOT NULL,
  original_narrative text NOT NULL,
  edited_narrative text NOT NULL,
  surf_conditions jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE narrative_edits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'narrative_edits' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON narrative_edits FOR ALL USING (true);
  END IF;
END $$;
