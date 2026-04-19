export interface OnboardingOption {
  id: string;
  emoji: string;
  label: string;
}

export interface OnboardingQuestion {
  id: string;
  title: string;
  subtitle: string;
  options: OnboardingOption[];
}

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: "experience",
    title: "What's your surf experience level?",
    subtitle: "We'll tailor forecasts and tips to match your skills",
    options: [
      { id: "beginner", emoji: "🌊", label: "Beginner — still learning" },
      { id: "intermediate", emoji: "🏄", label: "Intermediate — comfortable in the water" },
      { id: "advanced", emoji: "⚡", label: "Advanced — charging bigger waves" },
      { id: "pro", emoji: "🏆", label: "Pro / competitive surfer" },
    ],
  },
  {
    id: "style",
    title: "What's your preferred surf style?",
    subtitle: "Helps us highlight the most relevant conditions",
    options: [
      { id: "shortboard", emoji: "🔪", label: "Shortboard" },
      { id: "longboard", emoji: "🛹", label: "Longboard / cruising" },
      { id: "foil", emoji: "🚀", label: "Foil / hydrofoil" },
      { id: "bodysurf", emoji: "🤽", label: "Bodysurf / bodyboard" },
    ],
  },
  {
    id: "frequency",
    title: "How often do you surf?",
    subtitle: "No pressure — there's no wrong answer",
    options: [
      { id: "daily", emoji: "☀️", label: "Every day when conditions allow" },
      { id: "few_times", emoji: "📅", label: "A few times a week" },
      { id: "weekends", emoji: "🗓️", label: "Weekends only" },
      { id: "occasional", emoji: "👋", label: "Whenever I get the chance" },
    ],
  },
];
