# Design System: Paperboat

> Source of truth for the Paperboat design system, shared across all frontend projects
> (marketing, dashboard, and any future UI). When building any UI, prefer the tokens and
> scales defined here over ad-hoc values. If a screen needs something this document
> doesn't cover, extend this file first, then build.
>
> **Stack:** React (Astro islands on the marketing site, Next.js on the dashboard) · Tailwind CSS v4 (`@theme inline`) · shadcn/ui (`base-mira`) · OKLCH color.
> **Tokens live in:** each app's global stylesheet (e.g. `src/styles/global.css` / `app/globals.css`). This file describes how to *use* them.
>
> **Method:** scales are derived (documented 1.25 ratio; fluid `clamp()` for the hero,
> stepped Tailwind tokens everywhere else), not hand-picked, so they stay reproducible. Each
> section states its derivation; never invent a value at the component level.

---

## 1. Visual Theme & Atmosphere

Paperboat is **technical, calm, and confident** — an infrastructure product, not a toy.
The feeling is _engineered minimalism_: generous whitespace, a near-monochrome neutral
canvas, and a single saturated indigo doing all the emotional work.

- **Density:** Airy. Large type, wide gutters, deliberate breathing room. Never cramped.
- **Voice in type:** Display in **Space Grotesk** (geometric, slightly mechanical),
  body in **Geist** (neutral, highly legible), labels/eyebrows in **JetBrains Mono**
  (the "system / terminal" signal that says *developer tool*).
- **Color discipline:** Surfaces are white/neutral. Indigo (`--primary`) is the hero —
  used sparingly for emphasis, primary actions, and the dither artwork. Restraint is the rule.
- **Light first, dark ready:** The site is designed light. A dark theme exists in tokens
  (`.dark`) and every choice here must hold in both modes via semantic variables.

**The cardinal rule:** never hardcode a hex, px size, or one-off `text-[…]`. Reach for a
semantic color token, a step on the type scale, and a step on the spacing scale.

---

## 2. Color Palette & Roles

All color is defined in OKLCH and consumed through **semantic Tailwind utilities**
(`bg-primary`, `text-muted-foreground`, `border-border`, …). Never use a literal color
class like `bg-blue-600` or `text-white` for themed UI — the one allowed exception is
fixed-white text sitting on the indigo dither artwork (see §7).

### Brand & action
| Token | OKLCH (light) | Character | Role |
|---|---|---|---|
| `primary` | `0.488 0.243 264.376` | **Electric Royal Indigo** | Primary buttons, key emphasis, the dither field, brand mark on light surfaces |
| `primary-foreground` | `0.97 0.014 254.604` | **Cool Near-White** | Text/icons on top of `primary` |
| `ring` | `0.708 0 0` | **Neutral Gray** | Focus rings (keyboard focus must always be visible) |

### Neutral canvas
| Token | OKLCH (light) | Character | Role |
|---|---|---|---|
| `background` | `1 0 0` | **Pure White** | Page background |
| `foreground` | `0.145 0 0` | **Near-Black Ink** | Primary text |
| `muted` | `0.97 0 0` | **Whisper Gray** | Subtle fills, hover surfaces |
| `muted-foreground` | `0.556 0 0` | **Mid Slate Gray** | Secondary/supporting text, captions |
| `secondary` | `0.967 0.001 286.375` | **Faint Cool Gray** | Secondary button fills |
| `accent` | `0.97 0 0` | **Whisper Gray** | Hover/active background for ghost items |
| `border` | `0.922 0 0` | **Hairline Gray** | Dividers, input strokes, card edges |
| `input` | `0.922 0 0` | **Hairline Gray** | Input borders / track fills |

### Feedback
| Token | OKLCH (light) | Character | Role |
|---|---|---|---|
| `destructive` | `0.577 0.245 27.325` | **Signal Red** | Destructive actions, errors |

> **Charts** (`chart-1…5`) walk a light→deep indigo ramp — keep data viz inside this
> family so it reads as part of the same brand, not a rainbow.

### Contrast contract (WCAG)
- Body text uses `foreground` on `background` (passes AAA).
- `muted-foreground` clears AA (~4.6:1) **only on white/neutral surfaces** — fine for captions
  and secondary text there. Don't put it on `primary`, `secondary`, or any tinted fill.
- Text over the indigo dither **must** be `primary-foreground` / fixed white, and large or
  bold enough to survive the noisy background (≥ Lead size, ≥ medium weight). When in doubt,
  add the scrim (see §7).

---

## 3. Typography

Three variable fonts, three jobs. Exposed as `font-sans`, `font-heading`, `font-mono`.

| Role | Family | Utility | Used for |
|---|---|---|---|
| **Display / Headings** | Space Grotesk Variable | `font-heading` | `h1`–`h4`, hero, section titles |
| **Body / UI** | Geist Variable | `font-sans` (default on `html`) | Paragraphs, buttons, most UI text |
| **Label / Mono** | JetBrains Mono Variable | `font-mono` | Eyebrows, nav, kbd, code, metadata, badges |

### 3.1 Weight scale — fixed roles
Use only these four weights, **never more than two in a single view**:

| Weight | Class | Where |
|---|---|---|
| 400 Regular | `font-normal` | Body copy, paragraphs, captions, form labels |
| 500 Medium | `font-medium` | Buttons, nav, eyebrows, emphasized inline text |
| 600 Semibold | `font-semibold` | `h2`–`h4`, card/section titles, table headers |
| 700 Bold | `font-bold` | `h1` display + brand wordmark **only** |

Avoid 300/800/900 — they break the calm, even-color texture.

### 3.2 Derivation
- **Ratio:** Major Third (1.25) backbone. Tailwind's native `text-*` scale is itself ~1.25,
  so stepped roles use it directly — named, pixel-controlled, and zoom-safe.
- **Only the H1/display hero is fluid** (`clamp`), interpolating from a 360px mobile anchor
  to the 1280px desktop max (formula in §3.5) — smooth scaling matters most on the hero, and
  the `rem + vw` form keeps it responsive to browser zoom. **H2 and everything below are
  stepped** Tailwind tokens (what Vercel/Linear ship: zoom-safe, easy to QA).
- **Leading scales inversely** with size (1.6 body → 1.05 display); **tracking tightens** on
  display (negative em) and **opens** on the uppercase mono eyebrow (+0.18em).

### 3.3 The canonical scale
**Each row is the only approved way to render that role.** Size column gives the Tailwind
classes directly. `font` column: `H`=heading (Space Grotesk), `S`=sans (Geist),
`M`=mono (JetBrains).

| Role | Size (Tailwind classes) | px range | Leading | Tracking | Wt · Font |
|---|---|---|---|---|---|
| **Display / H1** _(fluid)_ | `text-[clamp(2.5rem,1.62rem+3.91vw,4.75rem)]` | 40→76 | `1.05` | `-0.03em` | 700 · H |
| **H2** | `text-3xl sm:text-4xl lg:text-5xl` | 30→36→48 | `1.1` | `-0.025em` | 600 · H |
| **H3** | `text-2xl lg:text-3xl` | 24→30 | `1.2` | `-0.02em` | 600 · H |
| **H4** | `text-xl lg:text-2xl` | 20→24 | `1.3` | `-0.01em` | 600 · H |
| **Lead / subtitle** | `text-lg lg:text-xl` | 18→20 | `1.5` | `0` | 400 · S |
| **Body** | `text-base` | 16 | `1.6` | `0` | 400 · S |
| **Body small** | `text-sm` | 14 | `1.5` | `0` | 400 · S |
| **Caption** | `text-xs` | 12 | `1.4` | `0` | 400 · S |
| **Eyebrow / label** | `text-xs` + `uppercase` | 12 | `1.3` | `0.18em` | 500 · M |
| **Nav label** | `text-sm` | 14 | `1` | `0.01em` | 500 · M |

- One H1 per page. Don't skip levels for styling — pick the role, not the size.
- Negative-tracking values are tuned for Space Grotesk's wide letterforms.
- Caption and Eyebrow are both 12px — distinguished by **font + case** (sans sentence-case
  vs. mono uppercase), not size.
- **Form/input labels** use the **Body-small** role (sans 14px), not the mono Nav label —
  mono is reserved for nav, eyebrows, and metadata.

### 3.4 How to apply it (doc-only, no token layer yet)
Apply each role as a small utility cluster — size class from §3.3 + font + weight + leading.
Examples:

```html
<!-- H1 (the one fluid role) -->
<h1 class="font-heading font-bold text-[clamp(2.5rem,1.62rem+3.91vw,4.75rem)]
           leading-[1.05] tracking-[-0.03em] text-balance">…</h1>

<!-- H2 (stepped) -->
<h2 class="font-heading font-semibold text-3xl sm:text-4xl lg:text-5xl
           leading-[1.1] tracking-[-0.025em] text-pretty">…</h2>

<!-- Lead -->
<p class="font-sans text-lg lg:text-xl leading-[1.5] text-muted-foreground text-pretty">…</p>

<!-- Body -->
<p class="font-sans text-base leading-[1.6]">…</p>

<!-- Eyebrow -->
<span class="font-mono font-medium text-xs uppercase tracking-[0.18em]">…</span>
```

> **When you're ready to enforce (later):** promote these to `@theme` `--text-*` entries in
> [`src/styles/global.css`](src/styles/global.css) (Tailwind v4 reads them as `text-h1`,
> `text-lead`, …) or define `.text-h1 { … }` utilities. Then components reference a role name
> instead of repeating the cluster. Out of scope for now (doc-only) — see §11.

### 3.5 The clamp formula (for the fluid display tier only)
Only the H1/display tier is fluid. To add another display-tier role, derive its `clamp` for
a size range `min→max` (px) across viewport `360→1280`:

```
slopeVw   = (max − min) / (1280 − 360) × 100        // the vw coefficient
intercept = (min − slopeVw/100 × 360) / 16          // rem
size      = clamp(min/16 rem, intercept rem + slopeVw vw, max/16 rem)
```

Always use `rem + vw` (never bare `vw`) so the size still responds to browser zoom. New
non-display roles stay stepped on Tailwind's native scale.

### 3.6 Measure (line length)
Readability dies past ~75 characters. Constrain every text block:

| Content | Max width |
|---|---|
| Long-form paragraphs / prose | `max-w-prose` (~65ch) |
| Hero / lead copy | `max-w-2xl` (≈42rem) |
| Section intro under a heading | `max-w-xl` (≈36rem) |
| Headlines | `max-w-3xl`–`max-w-4xl`, let them wrap naturally |

Use `text-pretty` on headings/lead (prevents orphans) and `text-balance` on short
multi-line headlines. Never let body text run the full width of a wide viewport.

---

## 4. Spacing & Rhythm

Everything sits on a **4px grid** (`1` = 0.25rem). Use only this **restricted set** so
rhythm stays predictable: **`1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32`** (4–128px).
Prefer `gap-*` (flex/grid) over margins; reserve margin for one-directional flow.

**The 3-step rhythm — the rule that makes spacing feel intentional.** At every scale,
nesting steps up roughly 2×, so proximity always signals grouping:

| Relationship | Gap | Token |
|---|---|---|
| **Inside a group** (icon ↔ label, label ↔ field) | 6–8px | `gap-1.5` / `gap-2` |
| **Between related elements** (stacked fields, button row) | 12–16px | `gap-3` / `gap-4` |
| **Between groups** (hero element stack, card sections) | 24–32px | `gap-6` / `gap-8` |
| **Between sub-sections** | 48–64px | `gap-12` / `gap-16` |
| **Between major page sections** | 96–128px | see padding below |

### Section vertical padding (fluid)
Sections breathe more on larger screens — fluid so it scales smoothly like the type:
```
py-[clamp(4rem,7vw,8rem)]      /* 64px → 128px */
```
Apply on every top-level `<section>` so the page has one steady, predictable pulse.

### Component internal padding
- Cards: `p-6` default → `p-8` for hero/feature panels → `p-4` compact. (3-step, again.)
- Don't override shadcn control padding per-instance — the variants already encode it.

---

## 5. Layout & Responsive Strategy

### Breakpoints (Tailwind defaults — design at these, test between them)
| Name | Min width | Primary intent |
|---|---|---|
| _base_ | 0 | **Mobile-first.** Single column, full-bleed artwork, stacked hero. |
| `sm` | 640px | Headings step up (H2→`text-4xl`), 2-up button rows, looser inline spacing. |
| `md` | 768px | Reveal primary nav, multi-column content grids. |
| `lg` | 1024px | **The big shift:** split layouts, side-by-side hero/artwork, headings step to max, `px-10` gutters. |
| `xl` | 1280px | Container reaches its max width (`max-w-7xl` = 1280px). |
| `2xl` | 1536px | Cap content width; grow margins, not measure. |

> The hero already pivots at `lg`: mobile stacks content over a full-bleed dither with an
> indigo scrim; desktop splits into a 2-column grid (`lg:grid-cols-2`) with artwork on the
> right. Treat `lg` as the canonical mobile↔desktop boundary for the whole site.

### Page container & gutters
Wrap page content in a centered container with responsive horizontal padding:
```
mx-auto w-full max-w-7xl px-6 lg:px-10
```
- **Gutters:** `px-6` mobile → `lg:px-10`. These already match the header & hero — keep them
  identical site-wide so vertical edges line up.
- **Max width:** `max-w-7xl` (80rem) for full sections; drop to `max-w-5xl`/`max-w-3xl` for
  text-led sections to protect measure.
- **Grids:** prefer `grid` + `gap-*` over hand-tuned margins. Common patterns:
  feature grid `grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8`; split hero
  `lg:grid lg:grid-cols-2`.

### Z-layering (from the hero)
Background artwork `z-0` → content `z-[1]` → header `z-10`. Keep overlays in this order;
sticky/fixed headers stay at the top layer.

---

## 6. Shape, Elevation & Borders

### Radius
Driven by `--radius: 0.625rem` (10px) with a derived scale in `@theme inline`.

| Token | Approx | Use |
|---|---|---|
| `rounded-sm` | 6px | Badges, kbd, small chips |
| `rounded-md` | 8px | Inputs, dropdown items |
| `rounded-lg` | 10px | **Default** — buttons, cards |
| `rounded-xl` | 14px | Prominent cards, modals |
| `rounded-2xl`+ | 18px+ | Large feature panels, media frames |
| `rounded-full` | pill | Avatars, icon buttons, status dots |

Default to `rounded-lg`. Don't mix many radii in one composition — pick one per surface tier.

### Elevation — flat first, then soft layered shadows
Hierarchy comes from tonal surfaces and the `border` hairline first; shadows stay soft and
only appear on things that float. Use multi-layer, low-opacity shadows (not a single hard one):

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | `border border-border` | Default cards, inputs, most surfaces |
| 1 — Raised | `shadow-sm` + `border` | Hover state of an interactive card |
| 2 — Floating | `shadow-md` | Dropdowns, popovers, tooltips (shadcn default) |
| 3 — Overlay | `shadow-lg` | Dialogs, sheets, command palette |

If you need exact values (e.g. a custom panel), these soft layered shadows match the house
feel — keep opacities this low:
```
--shadow-raised:  0 2px 2px rgba(0,0,0,0.04);
--shadow-float:   0 1px 1px rgba(0,0,0,0.02), 0 4px 8px -4px rgba(0,0,0,0.04), 0 16px 24px -8px rgba(0,0,0,0.06);
--shadow-overlay: 0 1px 1px rgba(0,0,0,0.02), 0 8px 16px -4px rgba(0,0,0,0.04), 0 24px 32px -8px rgba(0,0,0,0.06);
```
Avoid `shadow-xl`/`2xl` and colored glows. A 1px `border-border` between two white surfaces
is the default house style.

---

## 7. Component Conventions

shadcn/ui (`base-mira`) components are pre-styled — **use their variants, don't restyle per
instance.** Guidelines for composing them:

### Buttons
- **Primary CTA:** default/`bg-primary` variant. One primary action per view.
- **Secondary:** `variant="outline"`.
- **Tertiary / nav:** `variant="ghost"`.
- **Sizes:** `lg` for hero/header CTAs, default for in-page, `sm` for dense toolbars.
- Trailing icons use `data-icon="inline-end"`; keep icon size tied to button size (don't
  hand-size icons inside buttons).

### Eyebrows / labels
`font-mono text-xs font-medium uppercase tracking-[0.18em]` (the Eyebrow role, §3.3). On
mobile over the dither they go white; on light surfaces they go `text-primary` or
`text-muted-foreground`.

### Cards / containers
`rounded-lg border border-border bg-card p-6 lg:p-8`. Title = H3/H4 role, supporting text =
body-small in `text-muted-foreground`.

### Inputs / forms
Hairline `border-input`, `rounded-md`, `bg-background`. Always pair with a `<Label>` and a
visible focus `ring`. Never remove focus outlines.

### Working over the indigo dither (the one fixed-color zone)
The dither artwork is the **only** place fixed white is allowed instead of semantic tokens:
- Text/icons → fixed `text-white` (+ `/70` for secondary), switching to semantic
  `text-primary` / `text-muted-foreground` at `lg` where content sits on white.
- Keep a `bg-primary/50` scrim under text for legibility.
- This `white → semantic at lg` pattern is intentional — mirror it for any new section that
  overlays content on the artwork.

---

## 8. Motion & Interaction

Calm, fast, purposeful. Motion clarifies a change — it's never decoration. Most interactions
should feel **instant**; when an element genuinely reveals or moves, keep it short and
slightly physical.

**Two tiers, two tools:**
- **8.1 Micro-interactions** (hover, focus, state) → CSS transitions / `tw-animate-css`.
- **8.2 Entrance & scroll reveals** (content arriving on screen) → **`motion`** (Framer
  Motion, imported from `motion/react`), used in React islands only.

### 8.1 Micro-interactions

- **Durations:** ~150ms state changes (hover, focus) · ~200ms popovers/tooltips ·
  ~300ms overlays/modals. When in doubt, faster.
- **Signature easing** (subtle overshoot, feels physical without bouncing):
  ```
  --ease-physical: cubic-bezier(0.175, 0.885, 0.32, 1.1);
  ```
  Use it for reveals/moves; plain `ease-out` is fine for simple fades.
- **Transition only** `colors`, `opacity`, `transform` (cheap, GPU-friendly). Never animate
  layout (`width`/`height`/`top`) — it janks.
- **Hover:** a token shift (`hover:bg-primary/90`, `hover:bg-accent`), not a bounce.
- **Focus ring (non-negotiable):** every interactive element shows a ring at
  `:focus-visible` — a 2px surface-color gap then a 2px `ring`-color ring (the shadcn
  default already does this). Never remove an outline without a visible replacement.
- **Respect `prefers-reduced-motion`:** drop all non-essential motion (including the dither
  animation where feasible) behind the query.

### 8.2 Entrance & scroll reveals (`motion`)

When content **arrives** — a section scrolling into view, a footer, a list of cards — reveal
it with one shared vocabulary so every section breathes the same way. Canonical
implementation: [site-footer.tsx](components/site/site-footer.tsx).

**The fixed reveal tokens** (don't invent per-component values):

| Token | Value | Meaning |
|---|---|---|
| Distance | `y: 16` → `0` | How far a fading element travels up. Small — a settle, not a fly-in. |
| Duration | `0.6s` | One reveal. |
| Easing | `[0.16, 1, 0.3, 1]` | Expo-out — fast then gentle. The JS twin of `--ease-physical`, minus the overshoot. |
| Stagger | `0.06s` | Delay between siblings in a group. |
| Lead-in delay | `0.05s` | Before the first child starts. |

**The four sanctioned patterns** — reach for these, don't author new ones:

1. **Fade-up** (default for any block): `opacity 0→1`, `y 16→0`. This is the atom.
2. **Staggered group** (link columns, card grids, feature lists): a parent
   `staggerChildren: 0.06` over fade-up children. Items cascade in document order.
3. **Letter rise** (oversized display wordmarks only — e.g. the footer mark): each glyph in
   an `overflow-hidden` clip, sliding `y: 110% → 0%`, `stagger 0.05`. Reserved for one big
   statement per page; never for body or headings.
4. **Ambient drift** (the hero dither, looping rAF): continuous, sub-pixel, non-repeating.
   Not an entrance — background life only.
5. **On-load hero entrance** (hero text stack only): the staggered group, but triggered on
   mount (`initial="hidden"` `animate="show"`, not `whileInView`) and quicker — `y: 12`,
   `0.5s`, `stagger 0.07`. Canonical: [hero-content.tsx](components/site/hero-content.tsx).
   The hero needs `client:load` for this to run before paint.

**Rules of the road:**
- **Trigger on view, once:** `whileInView` + `viewport={{ once: true, amount: 0.25 }}`. Reveals
  fire as the user reaches a section and **never replay** — re-animating on every scroll is noise.
- **Transform/opacity only** — same GPU-cheap contract as §8.1. Never reveal by animating layout.
- **One reveal per section, not per element.** A footer fades its content as a group; it does
  not animate every link individually outside a stagger. Restraint reads as quality.
- **`prefers-reduced-motion`:** `motion` honors it when you gate variants, but verify — reduced
  users should see the final state instantly (`opacity: 1`, no transform), never a blank slab.
- **Hero is the one on-load exception** — don't *scroll-reveal* above-the-fold content (nothing
  scrolls into it). But a single **on-load entrance** is allowed and encouraged: it must be
  faster than a scroll reveal (`y: 12`, `0.5s`, `stagger 0.07`, `initial`/`animate` on mount —
  not `whileInView`) so the page reads as *arriving*, never as *withholding*. One per page, hero
  only. See pattern 5. Everything else below the fold uses the scroll reveals above.

```tsx
// The shared atoms — copy these, don't re-derive.
const EASE = [0.16, 1, 0.3, 1] as const;
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };

<motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}>
  <motion.div variants={item}>…</motion.div>
  <motion.div variants={item}>…</motion.div>
</motion.div>
```

> When hardening (§11), promote `EASE` / `container` / `item` to a shared
> `components/site/motion.ts` so every island imports the same constants instead of redefining them.

---

## 9. Accessibility Baseline

- Color contrast meets WCAG AA (body AAA). Don't communicate state with color alone.
- Every interactive element is keyboard-reachable with a visible focus ring.
- Semantic HTML: one `<h1>`, ordered headings, `<nav>`/`<header>`/`<section>` landmarks,
  `aria-hidden` on decorative artwork (as the dither already does).
- Hit targets meet WCAG 2.5.8 (≥24px). shadcn defaults are `h-9` (36px) / `lg` `h-10` (40px),
  which clear that — but for primary touch actions prefer `size="lg"` and aim for ~44px.
- Icon-only controls need an accessible label.

---

## 10. Quick Reference — Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Roles from §3.3 (fluid H1, stepped H2–H4) | Arbitrary `text-[2.5rem]` heading sizes |
| `text-xs uppercase tracking-[0.18em]` mono eyebrow | `text-[0.65rem]` one-offs |
| Fixed Tailwind tokens for body (16/14/12px) | Fluid-scaling body text |
| Only 4 weights, ≤2 per view | Stacking bold + large + uppercase + color at once |
| Semantic colors (`text-primary`, `bg-muted`) | `bg-blue-600`, raw hex, `text-white` (except over dither) |
| 3-step spacing rhythm off the 4px grid | `gap-[37px]`, `mt-[13px]` |
| `font-heading` / `font-sans` / `font-mono` by role | Mixing fonts ad hoc |
| `max-w-prose` / `max-w-2xl` on text | Full-viewport-width paragraphs |
| `border-border` + soft layered shadows | `shadow-xl`, glows, single hard shadow |
| `whileInView` + `once`, the §8.2 reveal tokens | Per-component fade values; reveals that replay on scroll |
| `px-6 lg:px-10` gutters, fluid section padding | Per-section custom padding |

---

## 11. Hardening

Progress on enforcing the spec in code rather than by convention:

1. ✅ **Type roles render reliably (done).** The roles (`.text-h1` … `.text-nav`) are authored
   as `@apply` clusters in **`@layer utilities`** (not components) so they beat the base
   `text-xs`/`text-sm` that shadcn primitives ship — utilities outrank components in the
   cascade. **And** they're registered with `tailwind-merge` in [`lib/utils.ts`](lib/utils.ts)
   (`extendTailwindMerge` → `font-size` group) so `cn()` no longer mistakes `text-nav` for a
   `text-{color}` and drops it when a color class is also present. Both were live bugs: the nav
   links silently rendered Geist 12px instead of mono 14px. Add any new role to **both** the
   `@layer utilities` block and the `ROLE_CLASSES` list.
   - *Still optional:* promoting the clusters to `@theme --text-*` tokens (Tailwind v4 reads
     them as generated utilities) would also work, but splits font-family off the size token —
     the `@apply` cluster keeps the whole role in one class, so we kept it.
2. ✅ **Shared motion (done).** The §8.2 reveal variants live in
   [`components/site/motion.ts`](components/site/motion.ts); every island imports them.
   *Remaining:* the `--shadow-float` / `--ease-physical` tokens from §6/§8 are defined in
   `@theme` but components don't all reference them yet.
3. **Refactor remaining arbitrary values.** [hero-content.tsx](components/site/hero-content.tsx)
   and [site-header.tsx](components/site/site-header.tsx) still carry some pre-system clusters;
   move them onto the roles where a role exists.
4. *(Optional)* an ESLint/Stylelint rule banning arbitrary `text-[…]`/`gap-[…]` so drift
   can't creep back in.

---

## 12. Illustration Language (schematics)

Every illustration on the site speaks **one** language — the technical schematic — derived
from the two brand anchors: the indigo dither field (hero) and the animated tunnel diagram
(architecture). Never introduce a second visual metaphor family (no freehand sketches, no
abstract geometry that isn't a diagram of something real).

**The vocabulary (all values fixed):**

| Element | Treatment |
|---|---|
| **Surface** | Figures sit **directly on the section, unframed** — like a schematic in a spec, never boxed in a card or panel. (UI mockups — phones, app windows, browser chrome — are the exception: they keep their own device/window frame.) |
| **Nodes** | `fill: var(--card)`, `stroke: var(--border)` at `1.25`, `rx 10–14` (matching the UI radius scale). Glyphs inside: `stroke: var(--foreground)` at `1.4`, opacity `0.7`. |
| **Paths** | Base `var(--border)` at `1.25`; traffic overlay `var(--primary)` dash `2 16`, opacity `0.5`, animated with the shared `.pb-flow` keyframes (global.css). This is the only sanctioned path animation. |
| **Focal** | Exactly **one** solid-indigo element per figure (`fill: var(--primary)`) — the thing the figure is about. |
| **Labels** | JetBrains Mono, `10–11px`, `letter-spacing 0.08em`, `var(--muted-foreground)` (or `--foreground` for node names). |
| **Status** | A `var(--primary)` dot with a slow opacity pulse (`2.4s`) means "running"; `var(--border)` fill means stopped. |

**Rules:** figures describe real platform behavior (a topology, a lifecycle, a state
machine) — never decoration. All motion is transform/dash-offset only and halts under
`prefers-reduced-motion`. Canonical examples:
[architecture.tsx](components/site/architecture.tsx) and
[how-it-works.tsx](components/site/how-it-works.tsx).
