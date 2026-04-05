## Codebase Inventory
- Framework: Next.js `15.5.14` with App Router
- Styling: Hybrid Tailwind + shared global CSS in `dashboard/app/globals.css`
- Component count: 51 `.tsx` files under `dashboard/components`
- Existing design tokens: Yes — legacy CSS custom properties in `dashboard/app/globals.css`
- New dark theme tokens: Yes — `--bg-primary`, `--bg-secondary`, `--bg-card`, `--accent-cyan`, `--accent-pink`, `--accent-purple`, `--glow-cyan`, `--glow-pink`, `--border-glow`
- Animation library: `framer-motion` not installed
- Font setup: Sora (display) + DM Sans (body) via `next/font`

## Pages Found
- `/` — `dashboard/app/page.tsx`
- `/accounts` — `dashboard/app/accounts/page.tsx`
- `/admin/system` — `dashboard/app/admin/system/page.tsx`
- `/analytics` — `dashboard/app/analytics/page.tsx`
- `/audit` — `dashboard/app/audit/page.tsx`
- `/billing` — `dashboard/app/billing/page.tsx`
- `/briefing/[id]` — `dashboard/app/briefing/[id]/page.tsx`
- `/briefing/share/[token]` — `dashboard/app/briefing/share/[token]/page.tsx`
- `/campaigns` — `dashboard/app/campaigns/page.tsx`
- `/conversations` — `dashboard/app/conversations/page.tsx`
- `/dashboard` — `dashboard/app/dashboard/page.tsx`
- `/dashboard/analytics` — `dashboard/app/dashboard/analytics/page.tsx`
- `/dashboard/dm-inbox` — `dashboard/app/dashboard/dm-inbox/page.tsx`
- `/dashboard/dm-settings` — `dashboard/app/dashboard/dm-settings/page.tsx`
- `/gov-preview` — `dashboard/app/gov-preview/page.tsx`
- `/insights` — `dashboard/app/insights/page.tsx`
- `/leads` — `dashboard/app/leads/page.tsx`
- `/login` — `dashboard/app/login/page.tsx`
- `/onboarding` — `dashboard/app/onboarding/page.tsx`
- `/onboarding/callback` — `dashboard/app/onboarding/callback/page.tsx`
- `/posts` — `dashboard/app/posts/page.tsx`
- `/pricing` — `dashboard/app/pricing/page.tsx`
- `/pulse` — `dashboard/app/pulse/page.tsx`
- `/reports` — `dashboard/app/reports/page.tsx`
- `/settings` — `dashboard/app/settings/page.tsx`
- `/settings/branding` — `dashboard/app/settings/branding/page.tsx`
- `/success` — `dashboard/app/success/page.tsx`
- `/usage` — `dashboard/app/usage/page.tsx`

## Component Catalogue
- `dashboard/components/app-providers.tsx` — Wraps the app with i18n and toast providers.
- `dashboard/components/auth-ready-gate.tsx` — Blocks rendering until auth bootstrap is complete.
- `dashboard/components/charts/bar-chart.tsx` — CSS-only message volume chart with hover tooltip.
- `dashboard/components/charts/css-chart-primitives.tsx` — Shared CSS chart building blocks.
- `dashboard/components/charts/stat-card.tsx` — KPI stat card with accent icon, value, and trend chip.
- `dashboard/components/dashboard-nav.tsx` — Alternate nav/header system with top bar and mobile drawer.
- `dashboard/components/demo-mode-banner.tsx` — Banner for demo/mock mode.
- `dashboard/components/empty/empty-state.tsx` — Existing empty-state component with SVG illustrations and CTA.
- `dashboard/components/form-toast.tsx` — Lightweight form toast.
- `dashboard/components/layout/app-frame.tsx` — Chooses shellless routes or wraps authenticated routes in `AppShell`.
- `dashboard/components/layout/app-shell.tsx` — Main authenticated shell with sidebar, sticky header, and notifications.
- `dashboard/components/MicroRewardToast.tsx` — Positive feedback toast for onboarding moments.
- `dashboard/components/MorningBriefingCard.tsx` — Fetches and displays the latest morning briefing.
- `dashboard/components/NotificationBell.tsx` — Notification trigger/dropdown component.
- `dashboard/components/page-enter.tsx` — Thin wrapper for route enter animation classes.
- `dashboard/components/page-skeleton.tsx` — Shared skeleton layouts for dashboard and list pages.
- `dashboard/components/pulse/celebration-burst.tsx` — Decorative celebration burst effect.
- `dashboard/components/pulse/conversation-pulse-widget.tsx` — Live pulse widget for conversation activity.
- `dashboard/components/pulse/onboarding-shell.tsx` — Alternate chrome for onboarding steps.
- `dashboard/components/pulse/pulse-board-home.tsx` — PulseBoard-style home shell.
- `dashboard/components/pulse/pulse-button.tsx` — Alternate Pulse button primitive.
- `dashboard/components/pulse/pulse-card.tsx` — Alternate Pulse card primitive.
- `dashboard/components/pulse/pulse-input.tsx` — Alternate Pulse input primitive.
- `dashboard/components/pulse/pulse-modal.tsx` — Alternate Pulse modal.
- `dashboard/components/pulse/pulse-shell.tsx` — Alternate Pulse app shell/navigation.
- `dashboard/components/pulse/pulse-tabs.tsx` — Tab switcher for Pulse sub-flows.
- `dashboard/components/pulse/pulse-toast.tsx` — Pulse-specific toast provider and UI.
- `dashboard/components/ReferralCard.tsx` — Referral CTA and sharing card.
- `dashboard/components/settings/BrandingSettings.tsx` — Branding form with live preview and logo upload.
- `dashboard/components/ShareGrowthCard.tsx` — Shareable follower/reach highlight card.
- `dashboard/components/theme-toggle.tsx` — Theme toggle that writes `data-theme` on the root element.
- `dashboard/components/ui/badge.tsx` — Badge primitive with tone variants.
- `dashboard/components/ui/brand-logo.tsx` — Logo wrapper with `/logo.png` image and fallback.
- `dashboard/components/ui/button.tsx` — Primary shared button with variants, loading, and success state.
- `dashboard/components/ui/card.tsx` — Shared card wrapper with accent stripe support.
- `dashboard/components/ui/circuit-bg.tsx` — Decorative circuit SVG background overlay.
- `dashboard/components/ui/input.tsx` — Shared floating-label input.
- `dashboard/components/ui/insight-pulse.tsx` — Insight callout block.
- `dashboard/components/ui/metric-stat.tsx` — Metric block with label, value, and hint.
- `dashboard/components/ui/modal.tsx` — Shared modal wrapper.
- `dashboard/components/ui/next-step-card.tsx` — Next-step CTA card.
- `dashboard/components/ui/page-header.tsx` — Page header primitive for eyebrow/title/description/actions.
- `dashboard/components/ui/progress-bar.tsx` — Shared horizontal progress bar.
- `dashboard/components/ui/skeleton.tsx` — Shared skeleton primitive.
- `dashboard/components/ui/upgrade-nudge.tsx` — Inline upgrade prompt.
- `dashboard/components/UpgradeModal.tsx` — Upgrade/paywall modal.
- `dashboard/components/usage/UsageMeter.tsx` — Usage/limit meter component.
- `dashboard/components/VoicePostButton.tsx` — Voice post recording and submit CTA.
- `dashboard/components/WowCard.tsx` — Marketing-style preview card.
- `dashboard/components/analytics/EngagementHeatStrip.tsx` — Heat-strip visualization for engagement by time.
- `dashboard/components/analytics/PostGrid.tsx` — Post grid with metrics and sorting.

## Already Themed (do not re-theme)
- `dashboard/app/globals.css` — dark vars added, plus `card-glow`, `gradient-text`, and utility classes
- `dashboard/components/dashboard-nav.tsx` — dark/nav refresh, gradient brand
- `dashboard/components/layout/app-shell.tsx` — dark shell and header
- `dashboard/components/charts/stat-card.tsx` — `card-glow` applied
- `dashboard/app/login/page.tsx` — dark radial gradient and gradient-text

## UI Inconsistency Audit

### Spacing Violations
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/app/globals.css` | `173`, `191`, `476` | MEDIUM | Content widths and shell spacing use multiple max-width systems (`.pulse-shell-content`, `.page-section`, `.page-shell`). | One consistent page container and spacing scale for all authenticated pages. |
| `dashboard/app/conversations/page.tsx` | `123`, `157`, `163`, `197` | MEDIUM | Many local inline spacing values (`marginBottom`, `margin`, widths/heights) diverge from shared card/list rhythm. | Use shared spacing tokens or consistent utility spacing on card sections and row content. |
| `dashboard/app/reports/page.tsx` | `133`, `144`, `149`, `154`, `159` | LOW | Hero/report metric blocks use ad hoc inline spacing and typography values. | Shared metric/card spacing should come from a single system, not repeated inline overrides. |

### Typography Violations
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/components/ui/page-header.tsx` | `12–18` | CRITICAL | `dash-page-*` classes referenced here have no matching CSS, so headers fall back to browser-default typography. | A single styled page-header system with defined sizes, weights, and spacing. |
| `dashboard/app/dashboard/page.tsx` | `146–148`, `172`, `227` | MEDIUM | Section titles and supporting copy mix raw inline styles with inherited globals. | Shared heading styles by semantic role: page title, section heading, body copy, timestamps. |
| `dashboard/app/success/page.tsx` | `19–51` | MEDIUM | Entire page uses hardcoded inline typography, bypassing the rest of the system. | Reuse shared heading/button/card typography where possible. |

### Color Violations
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/app/globals.css` | `16`, `60` | CRITICAL | `--text-primary` remains dark navy while `body.pulse-root` now uses the dark background. Default text can render dark-on-dark. | Text tokens for dark surfaces should be light, or dark tokens should be scoped to light legacy surfaces only. |
| `dashboard/app/globals.css` | `174`, `182`, `220`, `229`, `240`, `304`, `356` | HIGH | Several shared surfaces still use light `rgba(255,255,255,...)` backgrounds or light-surface assumptions in the global system. | Shared shell/header/card/input/toast/live-indicator surfaces should align with the dark theme tokens. |
| `dashboard/components/empty/empty-state.tsx` | `15–22`, `30–35`, `41–46` | MEDIUM | Empty-state illustrations are drawn for the old light palette with white fills and navy strokes. | Empty-state illustrations should be adapted to the dark theme token system. |

### Dark Theme Gaps
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/app/globals.css` | `174` | HIGH | `.pulse-header` still defines a light translucent background globally. Only `app-shell.tsx` overrides it inline. | Shared header styling should be dark by default so every usage is safe. |
| `dashboard/app/globals.css` | `220`, `229`, `304` | HIGH | Shared cards, inputs, and login card still assume light backgrounds globally. | Shared primitives should use dark-safe surfaces and tokenized borders/shadows. |
| `dashboard/components/NotificationBell.tsx` | `55–120` | HIGH | Uses `dark:` Tailwind branches, but the app theme toggle writes `data-theme`, not `class="dark"`. Those branches likely never activate. | Tailwind dark mode should match the app mechanism, or the component should use CSS variables consistently. |

### Component Duplication
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/components/layout/app-shell.tsx` + `dashboard/components/dashboard-nav.tsx` | whole files | HIGH | Two separate nav/chrome systems exist. `AppShell` is the mounted shell; `DashboardNav` is a parallel system with separate markup/state/styles. | One source of truth for app navigation and chrome. |
| `dashboard/components/ui/card.tsx` + `dashboard/components/pulse/pulse-card.tsx` + `dashboard/components/WowCard.tsx` | whole files | MEDIUM | Multiple card primitives represent similar surface concepts with different visual languages. | One card system with variants and clear purpose. |
| `dashboard/components/ui/skeleton.tsx` + `dashboard/components/page-skeleton.tsx` | whole files | LOW | Skeletons exist in both primitive and page-template forms, but the styling language is inconsistent and partially legacy. | Primitive + template skeletons should share one visual contract. |

### Interaction Gaps
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/components/theme-toggle.tsx` | `15–31` | HIGH | Theme toggle exists, but the mounted `AppShell` does not render it. Users cannot actually access theme switching from the real shell. | Either wire the toggle into `AppShell` or remove the dead path. |
| `dashboard/app/dashboard/page.tsx` | `54–55` | MEDIUM | Dashboard load failure is toast-only; there is no inline recoverable error state in the main content area. | A shared inline `ErrorState` with retry for data panes. |
| `dashboard/app/conversations/page.tsx` | `50–52`, `75–77` | MEDIUM | Conversation and message errors surface only in toasts, while the panels stay structurally empty. | Panels should have explicit error states and retry affordances. |

### Mobile Gaps
| File | Line(s) | Severity | What’s wrong | What it should be |
|---|---|---|---|---|
| `dashboard/app/globals.css` | `479–490` | MEDIUM | Several grids still compress to 2 columns on narrow screens, which can feel cramped on small Android devices. | KPI and billing grids should fall to 1 column earlier where readability suffers. |
| `dashboard/app/dashboard/page.tsx` | `231–237` | MEDIUM | Quick actions stack on mobile, but not all buttons are full-width, reducing thumb reach. | Mobile quick actions should prioritize full-width primary tap targets. |
| `dashboard/app/conversations/page.tsx` | `180–183`, `197–206` | LOW | The mobile thread slide-in works, but button sizing and inline styles are still hand-tuned. | Shared touch-target sizes and motion tokens for one-handed use. |

## Design Verdict
The dashboard has a strong visual direction, but it is still mid-migration between a legacy light design system and the newer PulseOS dark theme. The biggest drag on quality is that the foundational shared tokens and primitives are not fully aligned, so default text and many shared surfaces still think they are sitting on a light background. The second major issue is architectural duplication: there are parallel nav, card, and state patterns, which creates inconsistency every time a page is touched. Third, several important pages rely on missing or undefined presentation classes, so the UI can silently degrade into unstyled HTML without obvious compile failures. The result is not broken everywhere, but it feels like a product with premium fragments rather than one fully coherent system.

## Status After Refactor
- [FIXED] Shared text, surface, toast, modal, input, badge, table, and card primitives in `dashboard/app/globals.css` now align with the PulseOS dark theme without removing the legacy variables.
- [FIXED] Missing `dash-*` presentation classes are now defined, so `PageHeader`, `MetricStat`, `InsightPulse`, and `NextStepCard` no longer fall back to browser-default styling.
- [FIXED] Missing utility classes used across existing pages (`text-error`, `btn-primary`, `btn-secondary`, `table-wrap`, `data-table`, `app-nav-link`) are now defined centrally instead of leaving those routes partially unstyled.
- [FIXED] `framer-motion` was added and page transitions are now applied to `dashboard`, `conversations`, `reports`, `billing`, and `settings`.
- [FIXED] Staggered motion and animated count-up behavior now power the dashboard KPI grid and key list/card groups.
- [FIXED] Dashboard hierarchy was elevated with explicit page context, a hero insight card, upgraded stat cards, and mobile-friendlier quick actions.
- [FIXED] Shared loading, empty, and error contracts now cover the dashboard home, conversations, reports, analytics, posts, and leads surfaces.
- [KNOWN — NOT IN SCOPE] The duplicate navigation architecture (`AppShell` vs `DashboardNav`) still exists and should be consolidated in a separate cleanup pass.
- [KNOWN — NOT IN SCOPE] `ThemeToggle` is still not mounted in the live shell, and Tailwind dark-mode configuration still differs from the `data-theme` mechanism.
- [KNOWN — NOT IN SCOPE] Some lower-traffic routes still use older markup patterns and could be migrated to the newer page-header/state primitives in a follow-up pass.
- [KNOWN — NOT IN SCOPE] Grid breakpoint tuning can still be refined further for the narrowest Android screens after visual QA on real devices.

## Mobile QA — April 2026
Local QA target: dashboard `http://localhost:3000`, backend `http://localhost:4000`. Viewports tested: `360px`, `390px`, `768px`, and `1280px`. `768px` and `1280px` passed with no issue found across `/login`, `/dashboard`, `/conversations`, `/reports`, `/billing`, `/settings`, `/leads`, `/posts`, and `/analytics`.

### Login — 360px
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Some mobile tap targets are below 44x44: the password visibility control is `18x18`, and the support email link is `134x18`.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch target sizing for inline controls on the mobile login form.

### Dashboard — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `41px`, driven by the mobile shell/header and the dashboard content width.
- File: `dashboard/app/globals.css`
- Fix: Tighten narrow-phone shell spacing and clip intentional off-canvas chrome so it cannot create horizontal scroll.
- Severity: HIGH
- Issue: The KPI grid still renders in 2 columns at `360px` instead of the target 1-column stack.
- File: `dashboard/app/globals.css`
- Fix: Add an earlier narrow-phone breakpoint for `.overview-cards`.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several mobile tap targets are below 44x44, including the nav brand lockup, open/close nav controls, notifications, and the settings action.
- File: `dashboard/app/globals.css`
- Fix: Raise minimum touch sizes for primary mobile shell controls.

### Conversations — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `87px`; the thread shell and off-canvas mobile chrome still extend beyond the viewport.
- File: `dashboard/app/globals.css`
- Fix: Clip mobile shell overflow and tighten narrow-screen conversations layout spacing.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Filter pills and several shell actions remain below the 44x44 mobile tap-target floor.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for pills and shell actions.

### Reports — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `36px`, caused by narrow-screen header/chrome pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and prevent off-canvas chrome from producing page scroll.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: The shell brand row, nav controls, and notifications stay below the 44x44 tap-target floor.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Billing — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `100px`, with the narrow-screen shell plus billing layout exceeding the viewport.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and stack billing content earlier.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell controls remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Settings — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `138px`, amplified by narrow-screen shell pressure plus multi-column settings layout spans.
- File: `dashboard/app/globals.css`
- Fix: Force settings cards to a single-column flow on narrow phones and tighten the shell spacing.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: The mobile shell controls, plan label, and password visibility toggles remain under the 44x44 target.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell and form actions.

### Leads — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `19px`, caused by narrow-screen shell pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and clip off-canvas chrome.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: HIGH
- Issue: The `Copy lead ID` action renders at `58x42`, missing the 44px minimum height target.
- File: `dashboard/app/globals.css`
- Fix: Define a mobile-safe shared lead action button style with a 44px minimum height.

### Posts — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `39px`, caused by narrow-screen shell/header pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and prevent off-canvas chrome from creating page scroll.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell controls remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Analytics — 360px
- Severity: HIGH
- Issue: Horizontal overflow detected by `46px`, caused by narrow-screen shell/header pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and prevent off-canvas chrome from creating page scroll.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell controls remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Login — 390px
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Some mobile tap targets are below 44x44: the password visibility control is `18x18`, and the support email link is `134x18`.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch target sizing for inline controls on the mobile login form.

### Dashboard — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `10px`, caused by the narrow-screen shell/header and dashboard content width.
- File: `dashboard/app/globals.css`
- Fix: Tighten narrow-phone shell spacing and clip intentional off-canvas chrome so it cannot create horizontal scroll.
- Severity: HIGH
- Issue: The KPI grid still renders in 2 columns at `390px` instead of the target 1-column stack.
- File: `dashboard/app/globals.css`
- Fix: Add an earlier narrow-phone breakpoint for `.overview-cards`.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several mobile tap targets are below 44x44, including the nav brand lockup, open/close nav controls, notifications, and the settings action.
- File: `dashboard/app/globals.css`
- Fix: Raise minimum touch sizes for primary mobile shell controls.

### Conversations — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `56px`; the conversations shell still exceeds the narrow-phone viewport.
- File: `dashboard/app/globals.css`
- Fix: Clip mobile shell overflow and tighten narrow-screen conversations layout spacing.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Filter pills and several shell actions remain below the 44x44 mobile tap-target floor.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for pills and shell actions.

### Reports — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `6px`, caused by narrow-screen header/chrome pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and prevent off-canvas chrome from producing page scroll.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: The shell brand row, nav controls, and notifications stay below the 44x44 tap-target floor.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Billing — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `71px`, with the narrow-screen shell plus billing layout exceeding the viewport.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and stack billing content earlier.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell controls remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Settings — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `108px`, amplified by narrow-screen shell pressure plus multi-column settings layout spans.
- File: `dashboard/app/globals.css`
- Fix: Force settings cards to a single-column flow on narrow phones and tighten the shell spacing.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: The mobile shell controls, plan label, password visibility toggles, and dismiss buttons remain under the 44x44 target.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell and form actions.

### Leads — 390px
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell actions remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell actions.

### Posts — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `9px`, caused by narrow-screen shell/header pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and prevent off-canvas chrome from creating page scroll.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell controls and the empty-state CTA remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell and empty-state actions.

### Analytics — 390px
- Severity: HIGH
- Issue: Horizontal overflow detected by `16px`, caused by narrow-screen shell/header pressure.
- File: `dashboard/app/globals.css`
- Fix: Tighten mobile shell/header spacing and prevent off-canvas chrome from creating page scroll.
- Severity: HIGH
- Issue: The mobile sidebar brand/logo lockup overflows the drawer width.
- File: `dashboard/components/layout/app-shell.tsx`
- Fix: Reduce the mobile brand-row footprint and let the lockup shrink correctly inside the drawer.
- Severity: MEDIUM [KNOWN — BACKLOG]
- Issue: Several shell controls and the retry CTA remain below the 44x44 tap-target floor on mobile.
- File: `dashboard/app/globals.css`
- Fix: Increase minimum touch sizing for shell and retry actions.
