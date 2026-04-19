export interface OnboardingQuestion {
  id: string;
  title: string;
  subtitle: string;
}

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: "how_found",
    title: "How did you find out about us?",
    subtitle: "We'd love to know how you discovered SurfVista",
  },
  {
    id: "surf_location",
    title: "Where do you usually surf?",
    subtitle: "Tell us about your home break or favourite spots",
  },
  {
    id: "improvement",
    title: "How can we improve this app?",
    subtitle: "Your feedback helps us build a better experience",
  },
];
