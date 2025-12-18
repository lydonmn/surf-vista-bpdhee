
-- Create surf_conditions table to store raw NOAA buoy data
-- This table stores unprocessed data from NOAA Buoy 41004 before it's converted into surf reports

-- Drop table if it exists (for clean reinstall)
drop table if exists surf_conditions;

-- Create the table
create table surf_conditions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  wave_height text,
  wave_period text,
  swell_direction text,
  wind_speed text,
  wind_direction text,
  water_temp text,
  buoy_id text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table surf_conditions enable row level security;

-- Create RLS policies
-- Anyone can view surf conditions (public data)
create policy "Anyone can view surf conditions"
  on surf_conditions for select
  using (true);

-- Only service role can insert/update/delete (edge functions)
create policy "Service role can manage surf conditions"
  on surf_conditions for all
  using (auth.role() = 'service_role');

-- Create index for faster date lookups
create index if not exists surf_conditions_date_idx on surf_conditions(date);

-- Add helpful comment
comment on table surf_conditions is 'Stores raw NOAA buoy data from Station 41004 (Edisto, SC) before processing into surf reports';

-- Update weather_data table to match NOAA API structure
alter table weather_data 
  add column if not exists temperature_unit text,
  add column if not exists short_forecast text,
  add column if not exists detailed_forecast text,
  add column if not exists icon text;

-- Update weather_forecast table to match NOAA API structure
alter table weather_forecast
  add column if not exists period_name text,
  add column if not exists temperature number,
  add column if not exists temperature_unit text,
  add column if not exists wind_speed text,
  add column if not exists wind_direction text,
  add column if not exists short_forecast text,
  add column if not exists detailed_forecast text,
  add column if not exists is_daytime boolean;

-- Update tide_data table to include height unit
alter table tide_data
  add column if not exists height_unit text default 'ft';

-- Add comments to tables
comment on table weather_data is 'Current weather conditions from NOAA Weather Service API';
comment on table weather_forecast is '7-day weather forecast from NOAA Weather Service API';
comment on table tide_data is 'Tide predictions from NOAA Tides & Currents API (Station 8665530 - Charleston)';
comment on table surf_reports is 'Processed surf reports combining NOAA buoy, weather, and tide data';
