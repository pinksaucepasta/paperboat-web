# Design System: COSS Dashboard

**Project:** COSS Dashboard — Paperboat cloud-agent control panel  
**Source:** Current local implementation in `src/app/globals.css`, dashboard layouts, and UI primitives.

## 1. Visual Theme & Atmosphere

COSS Dashboard is a calm, technical control room for long-running developer infrastructure. It feels precise and trustworthy rather than flashy: an almost-white workspace, hairline dividers, generous breathing room, and one electric indigo accent that directs attention to actions and live status.

The application is deliberately airy. Data is grouped into quiet panels instead of dense dashboards, and operational complexity is reduced through clear hierarchy: navigation at the edge, context in the top bar, and one primary decision per view. The visual tone should remain composed in both light and dark modes; dark mode is an ink-black technical workspace, not a neon terminal.

Use color to clarify status and priority, never to decorate. Default surfaces are neutral and flat. Indigo communicates the Paperboat brand, selected state, progress, and primary action. Green, amber, and red are reserved for understandable operational feedback.

## 2. Color Palette & Roles

The palette is defined in OKLCH in `src/app/globals.css`. The hex values below are display equivalents for visual reference; implementation must continue to use semantic tokens such as `bg-primary`, `text-muted-foreground`, and `border-border`.

| Descriptive color | Value | Role |
| --- | --- | --- |
| Electric Royal Indigo | `#1447E6` — `oklch(0.488 0.243 264.376)` | The singular brand and action color: primary buttons, active navigation, progress, focused status, and small emphasis marks. |
| Cool Near-White | `#EFF6FF` — `oklch(0.97 0.014 254.604)` | Text and icons placed on the indigo action surface. |
| Near-Black Ink | `#0A0A0A` — `oklch(0.145 0 0)` | Primary text in light mode and the foundational canvas color in dark mode. |
| Pure White Canvas | `#FFFFFF` — `oklch(1 0 0)` | Light-mode application background, cards, popovers, and clean data surfaces. |
| Whisper Gray | `#F5F5F5` — `oklch(0.97 0 0)` | Quiet fills, hover states, selected-neutral areas, and muted information blocks. |
| Mid Slate Gray | `#737373` — `oklch(0.556 0 0)` | Supporting copy, timestamps, inactive metadata, and low-priority labels on light surfaces. |
| Hairline Gray | `#E5E5E5` — `oklch(0.922 0 0)` | Delicate boundaries between panels, inputs, rows, and shell regions. |
| Operational Green | `#009869` — `oklch(0.6 0.13 163)` | Healthy, running, active, or successful system states. Use with text or an icon label; never color alone. |
| Operational Amber | `#E99B2A` — `oklch(0.75 0.15 70)` | Queued, pending, warning, or attention-needed states. |
| Signal Red | `#E7000B` — `oklch(0.577 0.245 27.325)` | Failed states, destructive actions, and errors that need immediate attention. |
| Ink Card | `#101010` — `oklch(0.175 0 0)` | Dark-mode elevated surfaces, distinct from the near-black application canvas. |

In dark mode, keep the same functional relationships: a near-black canvas, slightly lighter cards and popovers, soft white borders, and a brighter indigo that remains legible without becoming fluorescent. Do not introduce unsemantic blues, purples, or gradients.

## 3. Typography Rules

Three fonts divide responsibility cleanly:

- **Space Grotesk** is the display voice. Use it for page titles, card titles, metric values, and the Paperboat wordmark. It should feel compact, confident, and slightly mechanical.
- **Geist** is the default body and interface voice. Use it for descriptions, forms, buttons, table content, and explanatory operational copy.
- **JetBrains Mono** signals system context. Use it sparingly for navigation groups, eyebrows, status metadata, branch names, code-like values, timestamps, and compact labels.

Use four weights only: regular for body copy, medium for controls and inline emphasis, semibold for panel titles, and bold only for the highest-level display heading. Avoid using more than two weights within one compact surface.

| Role | Visual treatment | Typical use |
| --- | --- | --- |
| Page title | Space Grotesk, semibold, `text-2xl` growing to `text-3xl` | Dashboard page headers. |
| Section and card title | Space Grotesk, semibold, compact `text-base` | Panels, activity blocks, settings groups. |
| Metric | Space Grotesk, semibold, `text-3xl`, tabular figures | Credits, storage, counts, runtime summaries. |
| Body | Geist, regular, `text-base` or `text-sm` | Explanations, forms, rows, and user-facing status copy. |
| Supporting metadata | Geist, regular, `text-xs` or `text-sm`, muted color | Timestamps, secondary values, helper text. |
| Eyebrow and system label | JetBrains Mono, medium, uppercase, widely tracked | Page context, sidebar group names, small operational labels. |
| Code and runtime data | JetBrains Mono, compact `text-xs` | Branches, script names, event timestamps, and setup content. |

Use tabular figures wherever a value may change over time so dashboard numbers do not jitter. Headings should be concise and direct; helper copy should explain a state or next action in plain language.

## 4. Component Stylings

### Buttons

Primary buttons are gently rounded, saturated indigo controls with cool near-white content and a restrained, shallow shadow. They represent the main action for a view: creating a project, confirming a meaningful decision, or proceeding through a setup step.

Outline buttons use a white or card-colored surface with a hairline border and become whisper gray on hover. Ghost buttons are reserved for low-emphasis navigation and compact utility actions. Destructive buttons are signal red and must be used only when the outcome is clearly irreversible. All controls keep a visible neutral-gray focus ring and retain generous touch targets.

### Cards and containers

Cards are quiet white or ink-card surfaces with generous, softly rounded corners, a hairline boundary, and only a whisper of depth. Their purpose is grouping, not visual spectacle. Standard cards use comfortable internal padding; headers separate title and supporting context with a small, regular gap.

Use subtle separators inside cards for distinct actions, settings sections, or footer areas. Avoid heavy shadows, colored borders, gradients, glass effects, or excessive nesting. A card may become slightly raised on interaction, but the default state remains calm and nearly flat.

### Inputs and forms

Inputs sit on the base canvas with a fine neutral stroke and softly rounded corners. Labels are direct, sentence-case, and placed visibly with their input. Helper text uses muted gray and explains constraints before an error occurs. Errors use red text and an explicit message; warnings use amber text and an explanation of the consequence.

Code and setup-script fields are a distinct quiet editor surface: compact mono text, a muted title bar, a fine border, and no ornamental syntax treatment unless it contributes to comprehension.

### Navigation shell

The shell is a layered workspace rather than a boxed application. The sidebar sits one tonal step away from the main canvas and contains the brand, grouped navigation, plan context, and a compact credit indicator. The active item is expressed through indigo iconography and a restrained accent surface, not a loud filled pill.

The top bar is a slim, sticky context strip with a translucent background, soft blur, breadcrumb context, theme control, and account access. It should preserve orientation without competing with page content.

### Status and feedback

Status badges are compact rounded labels with a small colored dot. Running and healthy are green; deploying is indigo; queued and attention-needed are amber; failed is red; paused or stopped is neutral. Always pair status color with a readable label.

Loading states should use a small spinner or skeleton in muted gray. Toasts may briefly scale for success or make a small horizontal shake for an error, then settle immediately. Empty states should state what is missing and offer the smallest useful next action.

## 5. Layout Principles

The dashboard uses an app-shell layout: persistent navigation on the left, a context bar at the top, and a flexible content canvas. On larger screens, the main canvas is slightly inset from the viewport with gently rounded outer corners; on smaller screens it becomes edge-to-edge and navigation collapses into an accessible compact control.

Use a mobile-first, single-column default. At larger breakpoints, expose the full sidebar and arrange related summary cards into compact grids. Page content uses a steady internal rhythm: small gaps inside controls, medium gaps between related fields, and larger gaps between cards or content groups. Typical dashboard padding grows from `p-4` on small screens to `p-6` and `p-8` as space allows.

Page headers place the eyebrow, title, and description in a vertical stack, with actions aligned to the trailing edge when the viewport permits. Keep explanatory copy narrow enough to remain readable; use wide space for data tables and project lists, not paragraphs.

Cards, tables, and activity lists align to a shared content edge. Use borders and whitespace to establish hierarchy before adding shadows. The dashboard should always make these three questions easy to answer at a glance: where the user is, what state the resource is in, and what action is safe to take next.

## 6. Motion, Accessibility, and Restraint

Motion is fast and functional. Hover, focus, and pressed feedback should feel immediate; transitions should affect color, opacity, or transform only. Never animate layout dimensions or use motion as decoration. Reduced-motion preferences must show the final state without delayed or repeated animation.

Every interactive control is keyboard reachable and has a visible focus ring. Icon-only actions require an accessible label. Text and status labels must communicate meaning independently of color. Maintain comfortable touch targets, semantic heading order, and clear empty, loading, warning, and error states.

When adding a new screen, preserve the central character of the dashboard: measured, clear, and technically capable. If a new element calls more attention to itself than the resource state or user decision it supports, simplify it.
