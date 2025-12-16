
export interface SurfReport {
  id: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  windDirection: string;
  tide: string;
  waterTemp: string;
  conditions: string;
  rating: number;
}

export interface VideoItem {
  id: string;
  title: string;
  date: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
}

export interface User {
  id: string;
  email: string;
  isSubscribed: boolean;
  isAdmin: boolean;
  subscriptionEndDate?: string;
}
