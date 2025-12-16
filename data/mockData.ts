
import { SurfReport, VideoItem } from '@/types';

export const mockSurfReports: SurfReport[] = [
  {
    id: '1',
    date: new Date().toISOString(),
    waveHeight: '3-5 ft',
    windSpeed: '10-15 mph',
    windDirection: 'NE',
    tide: 'High at 8:30 AM',
    waterTemp: '72°F',
    conditions: 'Clean offshore winds, glassy conditions',
    rating: 8,
  },
  {
    id: '2',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    waveHeight: '2-4 ft',
    windSpeed: '5-10 mph',
    windDirection: 'E',
    tide: 'Low at 2:15 PM',
    waterTemp: '71°F',
    conditions: 'Light winds, small clean waves',
    rating: 6,
  },
];

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
