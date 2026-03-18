
import { SurfReport, WeatherForecast } from '@/types';

function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const mockSurfReports: SurfReport[] = [
  {
    id: '1',
    date: getDateOffset(0),
    location: 'folly-beach',
    wave_height: '3-5 ft',
    surf_height: '3-5 ft',
    wave_period: '10s',
    swell_direction: 'ENE',
    wind_speed: '10 mph',
    wind_direction: 'NE',
    tide: 'High at 8:30 AM',
    water_temp: '72°F',
    conditions: 'Clean offshore winds, glassy conditions with fun-sized surf.',
    rating: 8,
  },
  {
    id: '2',
    date: getDateOffset(-1),
    location: 'folly-beach',
    wave_height: '2-4 ft',
    surf_height: '2-4 ft',
    wave_period: '9s',
    swell_direction: 'E',
    wind_speed: '8 mph',
    wind_direction: 'E',
    tide: 'Low at 2:15 PM',
    water_temp: '71°F',
    conditions: 'Light winds, small clean waves.',
    rating: 6,
  },
];

export const mockWeatherForecast: WeatherForecast[] = [
  {
    id: 'mock-0',
    date: getDateOffset(0),
    location: 'folly-beach',
    high_temp: 82,
    low_temp: 68,
    conditions: 'Partly cloudy with light offshore winds',
    swell_height_range: '3-5 ft',
    wind_speed: 10,
    wind_direction: 'NE',
    precipitation_chance: 10,
    prediction_confidence: 90,
    prediction_source: 'actual',
  },
  {
    id: 'mock-1',
    date: getDateOffset(1),
    location: 'folly-beach',
    high_temp: 80,
    low_temp: 66,
    conditions: 'Sunny, building swell from the south',
    swell_height_range: '4-6 ft',
    wind_speed: 12,
    wind_direction: 'SW',
    precipitation_chance: 5,
    prediction_confidence: 80,
    prediction_source: 'ai_prediction',
  },
  {
    id: 'mock-2',
    date: getDateOffset(2),
    location: 'folly-beach',
    high_temp: 78,
    low_temp: 65,
    conditions: 'Overcast with moderate onshore winds',
    swell_height_range: '2-4 ft',
    wind_speed: 15,
    wind_direction: 'SE',
    precipitation_chance: 30,
    prediction_confidence: 70,
    prediction_source: 'ai_prediction',
  },
  {
    id: 'mock-3',
    date: getDateOffset(3),
    location: 'folly-beach',
    high_temp: 76,
    low_temp: 64,
    conditions: 'Scattered showers, choppy conditions',
    swell_height_range: '2-3 ft',
    wind_speed: 18,
    wind_direction: 'E',
    precipitation_chance: 60,
    prediction_confidence: 65,
    prediction_source: 'ai_prediction',
  },
  {
    id: 'mock-4',
    date: getDateOffset(4),
    location: 'folly-beach',
    high_temp: 79,
    low_temp: 66,
    conditions: 'Clearing skies, improving surf',
    swell_height_range: '3-4 ft',
    wind_speed: 10,
    wind_direction: 'NW',
    precipitation_chance: 15,
    prediction_confidence: 60,
    prediction_source: 'baseline',
  },
  {
    id: 'mock-5',
    date: getDateOffset(5),
    location: 'folly-beach',
    high_temp: 83,
    low_temp: 69,
    conditions: 'Sunny with light offshore winds',
    swell_height_range: '3-5 ft',
    wind_speed: 8,
    wind_direction: 'W',
    precipitation_chance: 5,
    prediction_confidence: 55,
    prediction_source: 'baseline',
  },
  {
    id: 'mock-6',
    date: getDateOffset(6),
    location: 'folly-beach',
    high_temp: 85,
    low_temp: 70,
    conditions: 'Mostly sunny, fun surf expected',
    swell_height_range: '4-5 ft',
    wind_speed: 9,
    wind_direction: 'NW',
    precipitation_chance: 10,
    prediction_confidence: 50,
    prediction_source: 'baseline',
  },
];

export interface VideoItem {
  id: string;
  title: string;
  date: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
}

export const mockVideos: VideoItem[] = [
  {
    id: '1',
    title: 'Morning Session - Epic Conditions',
    date: new Date().toISOString(),
    thumbnailUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: '5:32',
  },
  {
    id: '2',
    title: 'Sunset Surf - Perfect Waves',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: '4:18',
  },
  {
    id: '3',
    title: 'Dawn Patrol - Glassy Conditions',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: 'https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?w=800',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: '6:45',
  },
];
