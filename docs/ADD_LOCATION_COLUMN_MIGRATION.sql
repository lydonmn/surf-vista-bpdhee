
-- Migration: Add location column to all data tables
-- This enables location-specific data for Folly Beach and Pawleys Island

-- Add location column to surf_reports table
ALTER TABLE surf_reports 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'folly-beach';

-- Add location column to weather_data table
ALTER TABLE weather_data 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'folly-beach';

-- Add location column to weather_forecast table
ALTER TABLE weather_forecast 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'folly-beach';

-- Add location column to tide_data table
ALTER TABLE tide_data 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'folly-beach';

-- Add location column to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'folly-beach';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_surf_reports_location ON surf_reports(location);
CREATE INDEX IF NOT EXISTS idx_weather_data_location ON weather_data(location);
CREATE INDEX IF NOT EXISTS idx_weather_forecast_location ON weather_forecast(location);
CREATE INDEX IF NOT EXISTS idx_tide_data_location ON tide_data(location);
CREATE INDEX IF NOT EXISTS idx_videos_location ON videos(location);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_surf_reports_location_date ON surf_reports(location, date DESC);
CREATE INDEX IF NOT EXISTS idx_weather_data_location_date ON weather_data(location, date);
CREATE INDEX IF NOT EXISTS idx_weather_forecast_location_date ON weather_forecast(location, date);
CREATE INDEX IF NOT EXISTS idx_tide_data_location_date ON tide_data(location, date, time);
CREATE INDEX IF NOT EXISTS idx_videos_location_created ON videos(location, created_at DESC);

-- Update existing data to have folly-beach as default location
UPDATE surf_reports SET location = 'folly-beach' WHERE location IS NULL;
UPDATE weather_data SET location = 'folly-beach' WHERE location IS NULL;
UPDATE weather_forecast SET location = 'folly-beach' WHERE location IS NULL;
UPDATE tide_data SET location = 'folly-beach' WHERE location IS NULL;
UPDATE videos SET location = 'folly-beach' WHERE location IS NULL;

-- Make location column NOT NULL after setting defaults
ALTER TABLE surf_reports ALTER COLUMN location SET NOT NULL;
ALTER TABLE weather_data ALTER COLUMN location SET NOT NULL;
ALTER TABLE weather_forecast ALTER COLUMN location SET NOT NULL;
ALTER TABLE tide_data ALTER COLUMN location SET NOT NULL;
ALTER TABLE videos ALTER COLUMN location SET NOT NULL;
