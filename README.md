
# SurfVista

Premium surf reports and forecasts for Folly Beach, South Carolina.

## Features

- 6K drone video surf reports
- Real-time surf conditions
- AI-powered surf predictions
- Subscription-based access via RevenueCat
- Admin panel for content management

## Tech Stack

- **Framework**: React Native with Expo 54
- **Navigation**: Expo Router
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Payments**: RevenueCat
- **Video**: Expo Video with TUS upload

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator or physical iOS device
- Xcode (for iOS builds)

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

### Building for iOS

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Build with EAS
eas build --platform ios --profile production
```

### Submission to App Store

```bash
eas submit --platform ios --profile production
```

## Project Structure

```
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   ├── admin*.tsx         # Admin screens
│   ├── login.tsx          # Authentication
│   └── video-player.tsx   # Video playback
├── components/            # Reusable components
├── contexts/              # React contexts (Auth, Widget)
├── hooks/                 # Custom hooks
├── utils/                 # Utility functions
├── styles/                # Shared styles
└── supabase/              # Edge functions

```

## Configuration

### Environment Variables

Create a `.env` file with:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### RevenueCat Setup

1. Configure products in App Store Connect
2. Set up offerings in RevenueCat dashboard
3. Update API keys in `utils/superwallConfig.ts`

## License

Proprietary - All rights reserved
