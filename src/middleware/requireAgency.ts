import { requireRole } from "./requireRole";

/** Only `AGENCY_ADMIN` (e.g. audit log viewer, agency-only registration). */
export const requireAgency = requireRole("AGENCY_ADMIN");
