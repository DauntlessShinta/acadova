# Acadova MASTER design-system recommendation

2026-10-05 · P7.1A refinement · React/Vite web application

This is a reviewed synthesis of the installed UI/UX Pro Max Python output and the existing Acadova implementation. It is a project-specific recommendation, not the unmodified CLI output or a new component framework. Exact queries and accepted/rejected results are recorded in P7_1A_REFINEMENT_REPORT.md.

## Product and hierarchy

Acadova is a student learning platform with peer tutoring and self-paced learning. Students can learn and teach with one account. The interface should make the next useful action understandable within seconds and keep coordination actions close to their relevant content.

Prioritize three Home choices: Find someone to teach me, Explore learning, Share what I know. Follow with real contextual activity: next Session/continue learning, incoming teaching requests, peers who can help and published topics. Omit absent data rather than inventing activity. Credits are a small utility status, not a dashboard centerpiece. No social feed or analytics overload.

## Navigation architecture

- Desktop: a compact sticky utility bar above the content plus a fixed 224px left primary sidebar. Utility height is 64px. This hybrid pattern is a synthesis supported by sticky-navigation, hierarchy and keyboard guidance; the tool did not prescribe this exact shell.
- Sidebar: Acadova identity; Home, Find Tutors, Learning, Sessions, Messages, Credits, Profile; Help near the bottom. Use icon plus text and a distinct active state. Fit normal laptop heights without independent sidebar scrolling.
- Utilities: scoped discovery search, Messages shortcut, Notifications, compact Credits, avatar/account. Avoid a second full primary navigation row. Notifications appear once in the current responsive header; the hidden desktop/mobile variant is not mounted to create redundant polling.
- Tablet/mobile at widths of 1024 CSS pixels or less: compact identity/search/Notifications/More header, four bottom destinations, other pages/account inside More. No desktop sidebar. Student navigation uses width only; short desktop viewports retain the sidebar and utility bar. Header height is reserved in normal flow with a shared 24px content gap.
- Staff: preserve the separate compact management shell and existing authorized destinations. Do not add Student links for visual symmetry.

## Search contract

Use one prominent discovery control with explicit scopes: Tutors by skill and Learning topics. Do not suggest people-name or combined ranked search support.

Tutor search routes to the existing /tutors?subject= endpoint, which matches teaching skills and returns at most 50 Students. Learning search routes to /learning?q= and filters the existing published-topic response by title (with legacy name fallback)/description; the API returns at most 100 topics. It does not search resource bodies or the entire database. Encode query values, limit supported query length, and preserve the existing Tutor search-symbol restrictions. Empty queries browse the selected scope.

No-match Learning results must explain recovery, offer Clear search and link to existing tutoring discovery. Mobile opens this same labeled form in the existing accessible Modal. No fabricated results, autocomplete or new search backend.

## Visual language

Retain the approved blue/white tokens: primary #1e3a8a, action #2563eb, canvas #f8fafc, white surfaces, text #0f172a and muted #475569. Keep existing semantic success/warning/danger surfaces with accompanying text or icons. Do not replace the palette with the generated education teal/amber scheme.

Retain Plus Jakarta Sans headings and Inter body with existing fallbacks and Lucide SVG icons. Avoid new font/icon dependencies. Use flat, readable cards with subtle borders/shadows and consistent focus states; avoid claymorphism, glass effects and decorative animation.

Use the existing 4/8/16/24/32 spacing tokens. Typical cards use 16–20px padding and 12–16px gaps. Compact labels may be 14px; long reading content remains comfortably sized and spaced. Topic cards use three columns at 1440px and wider, two columns above 700px, and one column at 700px and below. Keep natural card heights and complete descriptions. Do not adopt BI-style tiny typography or maximum widget density.

## Workflow and feedback

Use P7.1B Session tabs (Overview, Chat, Progress, Details), evidence-backed progress, contextual actions, sticky Save/lesson controls and progressive disclosure. Scroll content rather than stacking all workflows. Do not create nested scrolling except for naturally bounded message history, dialogs and data tables.

Field validation stays adjacent to its field with label, aria-invalid and aria-describedby where applicable; focus the first invalid control on submission. Do not restore the redundant validation banner. Policy explanations and persistent unavailable/load states remain contextual. Action outcomes use the existing single root Toast. Destructive decisions use the existing confirmation system before writes.

## Accessibility and responsive acceptance

Use semantic nav/form/button/link elements, visible keyboard focus, meaningful names for icon controls and sequential headings. Target normal-text contrast of at least 4.5:1; do not claim blanket WCAG certification. Preserve reduced-motion behavior and readable text reflow. Existing web controls use comfortable 44px interaction targets; native pt/dp rules are not treated as web units.

Sticky UI must not obscure focused controls: apply scroll-padding/scroll-margin offsets, place Toast below the utility header and offset sticky Session progress. Dialogs retain focus containment, Escape, Cancel and restoration. At 375/390px there must be no horizontal document overflow.

Before P7.1B, manually review desktop 1366x768/1440x900, tablet 768px, mobile 375/390px, 200% zoom, keyboard operation, realistic content and all relevant Session states. Automated fixtures support this review but do not replace visual sign-off.

## Text interactions and Learning hierarchy (final P7.1A polish)

Plain text links and text actions use semantic link-color/link-hover-color tokens, an underline at rest, a stronger underline on hover/focus, and the existing visible focus ring. Use text-link for anchors and text-action for secondary buttons. Navigation, branded links, cards, and primary buttons retain their established patterns. Disabled text actions lose the underline and pointer affordance. Footer links inherit their contrasting surface color. Body text does not inherit interaction styling.

ExternalResourceLink provides an external-link icon, an accessible new-tab announcement, and HTTPS-only links with noopener/noreferrer. The primary resource action remains a button-styled anchor. Resource sources are shown only when an actual URL is returned; missing metadata is omitted.

Learning uses compact topic/resource/module headings and wrapping breadcrumbs. Topic details prioritize Modules, then separately available topic Resources and topic Assessments. Show counts only from returned arrays, never infer hidden module contents. Modules show their resource order explicitly and use natural document scrolling. A returned module assessment appears after the Study content as Check your learning; omit it when absent. Keep existing resume/navigation and unlock behavior, without completion percentages or fabricated progress.

## Session coordination and messaging (P7.1B)

Keep participant/subject, current state and the valid next action above four mutually exclusive panels: Overview, Chat, Progress and Details. Put meeting editing and disclosed rescheduling in Details; keep progress evidence in Progress. Raw supported API states determine actions; display helpers and unsupported canonical contracts do not grant capabilities. Existing backend authorization remains authoritative.

Check in and Join Meeting are separate actions. Only a valid time/state permits check-in; opening an external HTTPS meeting with noopener/noreferrer proves no attendance. Face-to-face Sessions use the existing location and participant check-ins. First meeting-detail saves, chat sends, viewing and joining do not ask for confirmation. Replacing agreed details, declining a proposed schedule and submitting a dispute use the shared confirmation dialog, alongside existing consequential Session actions.

Chat shows peer/subject context, bounded scrollable history and an associated composer. Initially show newest messages; follow polling within 72px of the bottom and after a successful own send. Preserve an older-message reader's position and offer a counted new-message scroll hint. That hint is not a backend unread count. Preserve drafts on polling, tab changes and send failure. Announce send success inline instead of a toast for every message.

Fetch the current messages endpoint only with Chat selected in a visible, focused window and without a covering modal. The existing endpoint marks the entire thread read, including messages below an older-message reader; this frontend change cannot supply per-message read receipts. Already-started requests cannot be undone when the window later loses focus.

Global Messages opens a 420px desktop conversation drawer or full-width compact-screen picker at 1024px and below. The picker uses existing Session records plus recent notifications without reading message bodies. Selecting a conversation opens the single full Session Room Chat. The existing full-page Messages route uses the same picker. Display peer, subject and honest notification activity; never fabricate snippets or unread totals. Recent activity is limited to the latest 50 notifications.

Use one authenticated, account-keyed notification provider for the Bell, picker and optional audio; keep backend notifications and OneSignal delivery intact. Poll notifications every 60 seconds while visible, on focus and after relevant read actions. Sound defaults off, requires a user gesture, excludes initial history, own sends and the visible active thread, and has a 10-second cooldown. Persist the opt-in separately per account in local storage. Audio is supplemental; browser restrictions and storage failures must not prevent normal messaging or in-app feedback.
