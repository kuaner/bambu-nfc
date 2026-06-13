---
name: Bambu NFC
description: Dark technical PWA for reading and writing NFC tags on Bambu Lab filament spools via Chameleon Ultra
colors:
  chassis-black: "#0f1117"
  panel-dark: "#1a1d27"
  divider: "#2a2d3a"
  readout: "#e0e0e6"
  trace-gray: "#848aa3"
  scope-blue: "#4f8cff"
  scope-blue-bright: "#6fa0ff"
  signal-green: "#34d399"
  signal-yellow: "#fbbf24"
  signal-orange: "#f97316"
  signal-red: "#f87171"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.05em"
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.scope-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.scope-blue-bright}"
  chip:
    backgroundColor: "{colors.panel-dark}"
    textColor: "{colors.trace-gray}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-selected:
    backgroundColor: "{colors.scope-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
  card:
    backgroundColor: "{colors.panel-dark}"
    rounded: "{rounded.lg}"
    padding: "14px"
  input:
    backgroundColor: "{colors.chassis-black}"
    textColor: "{colors.readout}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
---

# Design System: Bambu NFC

## 1. Overview

**Creative North Star: "The Dark Room"**

Like a darkroom or an oscilloscope screen: near-black ambient, bright focused readouts, no decorative light. The interface is a precision instrument surface — every pixel carries information, nothing ornaments. The dark background reduces eye strain during focused work sessions under mixed desk lighting, while the single blue accent traces the user's path through the task.

This system is a **product register** tool. Design serves the task (scan a tag, write a tag, done), never the other way around. Information density is high but scannable — the user needs filament type, color, temperatures, and UID all at once, and the layout presents them without requiring scroll or navigation. The single accent color (Scope Blue) appears only on primary actions and active states; its rarity is the point. Semantic signal colors (green/yellow/orange/red) report hardware state — connected, drying temp, error — and nothing else.

The system explicitly rejects consumer-friendly onboarding patterns, SaaS dashboard conventions, and any decorative motion. It is a tool that knows what it is.

**Key Characteristics:**
- **Restrained color** — one accent, four semantic status colors, the rest neutral
- **Tonal depth** — layers (Chassis Black → Panel Dark → Divider) create hierarchy without shadows
- **Tactile confidence** — clear borders, strong affordance, satisfying click targets
- **Compact density** — tight spacing, small radii, information-first layout
- **State as truth** — every color change reflects hardware state, never decoration

## 2. Colors

The palette is a dark neutral foundation with one cool-blue accent and four semantic signal colors inherited from hardware status conventions.

### Primary
- **Scope Blue** (`#4f8cff`): The single accent. Primary actions (scan, write, connect), active tab state, selected items, and interactive focus. Appears on ≤10% of any given screen. Its rarity makes it noticeable.

### Neutral
- **Chassis Black** (`#0f1117`): Page background. The darkest surface — the "darkroom" ambient.
- **Panel Dark** (`#1a1d27`): Card backgrounds, tab bar, surfaces one step above the chassis. Slightly warm-tinted dark blue-gray.
- **Divider** (`#2a2d3a`): Borders, dividers, and stroke-only elements. The visible seam between surfaces.
- **Readout** (`#e0e0e6`): Primary text color. High contrast against all dark surfaces (14.4:1 on chassis, 12.8:1 on panel).
- **Trace Gray** (`#848aa3`): Secondary text, labels, metadata, inactive states. Meets WCAG AA at 4.9:1 on panel and 5.5:1 on chassis.

### Semantic (status only)
- **Signal Green** (`#34d399`): Connected state, success. Used for the connection dot indicator and write-complete states.
- **Signal Yellow** (`#fbbf24`): Warning, drying temperature indicators.
- **Signal Orange** (`#f97316`): Hotend temperature indicators.
- **Signal Red** (`#f87171`): Disconnected state, errors, write failure. Used for the disconnected dot and error messages.

### Named Rules

**The One Trace Rule.** Scope Blue is used for primary actions, current selection, and interactive focus only. Never for decorative emphasis, section headers, or icon fills on inactive elements. If it appears more than twice on a screen, reconsider.

**The Signal Discipline Rule.** Green, yellow, orange, and red are reserved for hardware state reporting. Never use them for branding, decoration, or visual hierarchy. A red element means "error/disconnected"; a green element means "connected/success." No other meaning is permitted.

**The Trace Gray Floor Rule.** Trace Gray is the darkest secondary text may go. If a design calls for text lighter than Readout but darker than Trace Gray, use Trace Gray — do not invent an intermediate gray. The two-value text system (Readout + Trace Gray) is the palette.

## 3. Typography

**Font:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`)
**Mono:** None — no monospace font is used. UIDs and technical values use the body font.

**Character:** One family, six weight steps (400–800). No pairing, no display ornament. The system font renders crisply on all platforms and recedes into the task. Weight contrast (bold titles vs. regular body) provides hierarchy without font-family changes.

### Hierarchy
- **Display** (800 weight, 2.5rem, line-height 1): The connect overlay title "Bambu NFC". The only extrabold usage in the system. Appears once, on first load.
- **Title** (700 weight, 1.05rem, line-height 1.2): Top bar app name, tag info card title. The default "heading" weight.
- **Body** (400 weight, 0.875rem, line-height 1.625): All descriptive text, tag metadata, status messages. Never exceeds 65ch in this compact layout.
- **Label** (600 weight, 0.7rem, uppercase, 0.05em tracking): Form section labels ("CATEGORY", "MATERIAL", "COLOR"). Functional markers, not decorative eyebrows.
- **Meta** (400 weight, 0.65rem, line-height 1.5): Version number, disclaimer, dump count. The smallest readable tier.

### Named Rules

**The One Family Rule.** One font stack for everything. No second font, no monospace variant, no display face. Weight and size create hierarchy; font-family never does.

**The Label Purpose Rule.** Uppercase tracked labels appear only on form section dividers (Write page category/material/color). They are functional markers that describe the input below them, not decorative section headers. If a label doesn't directly precede an interactive element, it shouldn't exist.

## 4. Elevation

Flat by default. Depth is conveyed through **tonal layering**, not shadows.

The three neutral surface values (Chassis Black → Panel Dark → Divider) create a stepped elevation system: the page is the darkest, cards sit one step lighter, and borders mark the seam between them. This is sufficient for all static surfaces.

**Shadow Vocabulary:**
- **Dropdown** (`box-shadow: 0 8px 24px rgba(0,0,0,0.5)`): Applied only to the color dropdown popover, which escapes its container via the native popover API (top layer). This is the sole shadow in the system.

### Named Rules

**The Flat-By-Default Rule.** Cards, buttons, chips, inputs — all flat at rest. No box-shadow on any static or resting element. The tonal step between Chassis Black and Panel Dark is the entire elevation story for fixed surfaces.

**The Floating Exception Rule.** Shadows are permitted only on elements that render in the top layer (popovers, dialogs). A shadow signals "this element is detached from the page surface." If the element isn't detached, it doesn't get a shadow.

## 5. Components

Tactile and confident: clear borders, strong affordance, satisfying click targets. Every interactive element is unmistakably interactive.

### Buttons
- **Shape:** Gently rounded (10px radius)
- **Primary:** Scope Blue background, white text, 12px 20px padding, semibold. Full-width on mobile-like compact layouts.
- **Hover:** Scope Blue Bright (`#6fa0ff`). 200ms color transition.
- **Focus:** 2px Scope Blue outline, 2px offset. Visible on keyboard navigation only (`:focus-visible`).
- **Disabled:** 35% opacity. Cursor not-allowed.
- **Secondary / Ghost:** Panel Dark background, Divider border, Trace Gray text. On hover: border shifts to Scope Blue, text shifts to Scope Blue.

### Chips / Pills
- **Shape:** Fully rounded (9999px radius for category pills, 8px for material buttons)
- **Default:** Panel Dark background, Divider border, Trace Gray text.
- **Selected:** Scope Blue background, Scope Blue border, white text.
- **Hover:** Border lightens to a mid-gray before selection.

### Cards / Containers
- **Corner Style:** 12px radius
- **Background:** Panel Dark
- **Border:** 1px Divider
- **Shadow Strategy:** None (see Elevation: Flat-By-Default Rule)
- **Internal Padding:** 14px (3.5 in Tailwind spacing)
- **Card Swap Animation:** 450ms ease-in-out transform+opacity keyframe. Reduced to a 200ms opacity crossfade when `prefers-reduced-motion: reduce` is active.

### Inputs / Select Fields
- **Style:** Chassis Black background, 1px Divider border, 8px radius, Readout text.
- **Focus:** Border shifts to Scope Blue.
- **Custom Select:** Native `<select>` with custom arrow (SVG chevron). Background and border match the token system.
- **Dropdown:** Uses native popover API (`popover="auto"`) to escape scroll containers. Panel Dark background, Divider border, 12px radius, Dropdown shadow.

### Navigation (Tab Bar)
- **Position:** Fixed bottom, full-width. Height 56px + safe-area-inset.
- **Background:** Panel Dark with 1px Divider top border.
- **Inactive Tab:** Trace Gray icon + label at 0.65rem semibold.
- **Active Tab:** Scope Blue icon + label.
- **ARIA:** `role="tablist"` on nav, `role="tab"` + `aria-selected` on each button, `role="tabpanel"` + `aria-label` on page containers.

### Color Swatch
- **Single Color:** Inline-block square (20px or 16px), 2px Divider border, 5px/3px radius.
- **Dual Color:** Two adjacent squares sharing a border, left rounded left, right rounded right. Represents filament with a primary + secondary color.

### Spinner
- **Style:** 36px circle, 3px Divider border with Scope Blue top border. CSS `animate-spin`.
- **Accessibility:** `role="status"`, `aria-label="Loading"`.
- **Reduced Motion:** Animation disabled entirely.

## 6. Do's and Don'ts

### Do:
- **Do** use Scope Blue (`#4f8cff`) exclusively for primary actions, active states, and focus indicators. Its rarity is the design.
- **Do** use the tonal step (Chassis Black → Panel Dark → Divider) for all surface hierarchy. No shadows needed.
- **Do** use Signal Green/Yellow/Orange/Red only for hardware state. Green = connected/success, Red = error/disconnected, Yellow = warning, Orange = temperature.
- **Do** include `:focus-visible` rings on all interactive elements for keyboard accessibility.
- **Do** respect `prefers-reduced-motion` by replacing complex animations with simple opacity crossfades.
- **Do** use ARIA roles (`tablist`, `tab`, `tabpanel`, `listbox`, `option`, `status`) on all custom interactive patterns.
- **Do** use the native popover API for dropdowns that need to escape scroll containers.
- **Do** keep the system font stack. Platform-native rendering is the right choice for a technical tool.

### Don't:
- **Don't** add shadows to cards, buttons, or any element attached to the page surface. Shadows are for detached top-layer elements only.
- **Don't** use Scope Blue for decorative purposes (icon fills on inactive states, section headers, background tints). It's an action color, not a brand color.
- **Don't** introduce a second font family or monospace variant. Weight and size create hierarchy; font-family never does.
- **Don't** use `outline: none` without a `:focus-visible` replacement. Keyboard users must see where they are.
- **Don't** animate layout properties (width, height, top, left). Use `transform` and `opacity` only.
- **Don't** add onboarding wizards, progress milestones, celebration confetti, or gamification patterns. Per PRODUCT.md: "Not a consumer-friendly onboarding wizard with progress milestones and celebration confetti."
- **Don't** use SaaS dashboard patterns (sidebar navigation, charts, empty card grids, data tables). This is a two-tab utility, not a platform.
- **Don't** tint neutral surfaces toward warm or cool "for atmosphere." The neutral palette is the hardware aesthetic; warmth is carried by content (filament colors), not by the interface chrome.
