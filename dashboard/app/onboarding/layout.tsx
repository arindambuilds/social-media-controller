import { OnboardingShell } from "../../components/pulse/onboarding-shell";

export default function OnboardingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <OnboardingShell>{children}</OnboardingShell>;
}
