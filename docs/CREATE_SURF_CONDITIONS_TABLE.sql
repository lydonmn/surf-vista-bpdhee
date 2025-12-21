
-- Create surf_conditions table
CREATE TABLE IF NOT EXISTS public.surf_conditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  wave_height text,
  wave_period text,
  swell_direction text,
  wind_speed text,
  wind_direction text,
  water_temp text,
  buoy_id text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.surf_conditions ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow public read access to surf_conditions" ON public.surf_conditions;
CREATE POLICY "Allow public read access to surf_conditions"
  ON public.surf_conditions
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access to surf_conditions" ON public.surf_conditions;
CREATE POLICY "Allow service role full access to surf_conditions"
  ON public.surf_conditions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index on date for faster queries
CREATE INDEX IF NOT EXISTS idx_surf_conditions_date ON public.surf_conditions(date DESC);

-- Grant permissions
GRANT SELECT ON public.surf_conditions TO anon, authenticated;
GRANT ALL ON public.surf_conditions TO service_role;
