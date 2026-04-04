/** page-enter: wraps all `/briefing/*` pages once (staggered reveal). */
import { BriefingEnter } from "./briefing-enter";

export default function BriefingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <BriefingEnter>{children}</BriefingEnter>;
}
