# Product

## Register

product

## Users

DIY 3D printing enthusiasts who own a Chameleon Ultra device and want to read, clone, or write NFC tags on Bambu Lab filament spools. They're comfortable with hardware tools and Bluetooth pairing; many use third-party filament and need their printer to recognize it as a known spool. They work at a desk with their printer and Chameleon Ultra nearby, typically in a single short session (scan a tag, write a tag, done).

## Product Purpose

A focused PWA that bridges a Chameleon Ultra (via Web Bluetooth) to Bambu Lab filament NFC tags. Two core flows: **Scan** reads and parses a tag's full contents (material, color, temperatures, UID); **Write** lets the user pick a filament from a known database and burn it onto a blank tag. Success = the user finishes their task in under a minute with zero ambiguity about what happened. The tool should disappear into the task.

## Brand Personality

**Confident, technical, compact.** The interface feels like a well-made hardware utility — think oscilloscope UI or a pro camera menu, not a consumer app. Every pixel earns its place. Information density is high but scannable. The dark surface reduces eye strain during focused work sessions under mixed ambient light (desk lamps, printer LED strips). Animations are brief and stateful, never decorative.

## Anti-references

- Not a consumer-friendly "onboarding wizard" with progress milestones and celebration confetti.
- Not a SaaS dashboard with sidebar nav, charts, or empty-card grids.
- Not a playful or gamified interface — this is a precision tool for a technical audience.

## Design Principles

1. **Tool, not product.** The interface is a means to an end. Users come to do one thing and leave. Optimize for speed and clarity over engagement.
2. **Earned density.** Pack information tightly because the user needs it all at once — filament type, color, temperatures, UID — but never crowd for its own sake. Each data point is there because the user will act on it.
3. **State is truth.** Connection status, scan progress, write result — the UI must be an honest, real-time mirror of what the hardware is doing. No ambiguity, no stale states.
4. **Compact confidence.** Small radii, tight spacing, restrained color. The visual language says "this works correctly" without decoration. One accent color for primary actions; semantic colors only for status.
5. **Bilingual by default.** Chinese and English are first-class. Neither is a translation of the other — both are written natively.

## Accessibility & Inclusion

- Target WCAG 2.1 AA contrast ratios across the dark theme (4.5:1 for body text, 3:1 for large text).
- The current palette (`#e0e0e6` on `#0f1117`) exceeds this; maintain it.
- Respect `prefers-reduced-motion` for the card-swap animation and any future motion.
- Desktop-only surface (Web Bluetooth dependency) — no mobile viewport concerns, but ensure the layout works at narrow desktop widths (1024px+).
