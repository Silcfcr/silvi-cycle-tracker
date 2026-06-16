# Desktop Layout — Design Spec
Date: 2026-06-16

## Goal

Improve the laptop/desktop experience by replacing the narrow centered mobile column with a purposeful two-panel layout that separates "today" context from "over time" history.

## Layout

### Header band
The gradient band spans the full width of the page on desktop (same visual, just wider). No structural change to its content.

### Two-panel grid
Below the band, a `.desktop-panels` wrapper splits the content into two equal columns (50/50, `grid-template-columns: 1fr 1fr`, gap 24px).

| Left panel — "Today" | Right panel — "Over time" |
|---|---|
| Phase ring card + CycleBar | Calendar (Your month) |
| Today's mood card | 14-day strip |
| Body measurements card | Weight chart |

### Container
- Max-width: **1100px**, centered (`margin: 0 auto`)
- Desktop breakpoint: **900px** (`min-width: 900px`)
- Below 900px: current single-column mobile layout, completely unchanged

### Scrolling
Whole page scrolls as one. No panel-level independent scroll.

## Implementation scope

### `src/index.css`
- Widen `.app` max-width to 1100px at `min-width: 900px`
- Add `.desktop-panels` grid rule (active only at 900px+; stacks to single column on mobile)
- Ensure the `.band` fills the full `.app` width (it already does via position)
- Ensure `.sheet` padding works correctly at wider widths

### `src/Dashboard.jsx`
- Wrap the card groups inside the main `Dashboard` render in a `<div className="desktop-panels">` 
- Left child div: PhaseRingCard + CycleBar, MoodCard, MeasurementsCard
- Right child div: CalendarCard, RecentStrip, WeightChart
- No logic changes — purely structural JSX grouping

## What does NOT change
- Mobile layout (below 900px): identical to current
- All card content, interactions, modals, and data flow
- The band component
- Onboarding and LoginScreen (they are full-screen overlays, unaffected)
