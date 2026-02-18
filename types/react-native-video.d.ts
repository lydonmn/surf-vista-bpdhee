
declare module 'react-native-video' {
  import { Component } from 'react';
  import { ViewStyle, StyleProp } from 'react-native';

  export interface OnLoadData {
    currentTime: number;
    duration: number;
    naturalSize: {
      width: number;
      height: number;
      orientation: 'portrait' | 'landscape';
    };
    audioTracks: any[];
    textTracks: any[];
  }

  export interface OnProgressData {
    currentTime: number;
    playableDuration: number;
    seekableDuration: number;
  }

  export interface OnBufferData {
    isBuffering: boolean;
  }

  export interface VideoProperties {
    source: { uri: string } | { uri: string; headers?: Record<string, string> };
    style?: StyleProp<ViewStyle>;
    paused?: boolean;
    volume?: number;
    muted?: boolean;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    repeat?: boolean;
    playInBackground?: boolean;
    playWhenInactive?: boolean;
    onLoad?: (data: OnLoadData) => void;
    onProgress?: (data: OnProgressData) => void;
    onBuffer?: (data: OnBufferData) => void;
    onError?: (error: any) => void;
    onEnd?: () => void;
    bufferConfig?: {
      minBufferMs?: number;
      maxBufferMs?: number;
      bufferForPlaybackMs?: number;
      bufferForPlaybackAfterRebufferMs?: number;
    };
    automaticallyWaitsToMinimizeStalling?: boolean;
    poster?: string;
    posterResizeMode?: 'contain' | 'cover' | 'stretch';
  }

  export default class Video extends Component<VideoProperties> {
    seek(time: number): void;
  }
}
