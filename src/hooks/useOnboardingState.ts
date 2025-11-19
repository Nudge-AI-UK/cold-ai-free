// Re-export from OnboardingContext for backward compatibility
// All onboarding state is now shared via context so all widgets update together
export { useOnboardingContext as useOnboardingState } from '@/contexts/OnboardingContext';
export type { OnboardingStep } from '@/contexts/OnboardingContext';
