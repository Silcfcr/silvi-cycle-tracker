# Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-panel desktop layout that splits "today" cards (left) from "over time" cards (right) at viewports ≥ 900px, while leaving the mobile layout untouched.

**Architecture:** `Dashboard.jsx` already has `col-left` / `col-right` divs inside a `content-grid` wrapper — the JSX is done. All work is CSS: add grid rules at the 900px breakpoint, widen `.app`, and give the columns flex-column layout so cards space themselves.

**Tech Stack:** Plain CSS (no new dependencies)

---

### Task 1: Add desktop grid CSS to `src/index.css`

**Files:**
- Modify: `src/index.css` — add after the existing `@media (min-width: 700px)` block (around line 429)

**Context on the current state:**
- `.app` is capped at `max-width: 480px` for mobile
- `.content-grid`, `.col-left`, `.col-right` exist in the JSX but have **no CSS rules at all** — divs stack as plain block elements
- `.sheet` has `padding: 26px 22px 40px` and `border-radius: 28px 28px 0 0`
- `.band` has `padding: max(16px, env(safe-area-inset-top)) 26px 60px`

- [ ] **Step 1: Add base column styles (apply on all screen sizes)**

In `src/index.css`, after the `.sheet { ... }` block (around line 466), add:

```css
/* ── Two-panel grid ──────────────────────────────────────────── */
.content-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.col-left,
.col-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
```

This gives all cards 20px breathing room between them on mobile (currently they have none) and sets up the semantic column structure.

- [ ] **Step 2: Add desktop breakpoint rules**

Immediately after the block you just added, add:

```css
@media (min-width: 900px) {
  .app {
    max-width: 1100px;
  }
  .band {
    padding-left: 40px;
    padding-right: 40px;
  }
  .sheet {
    padding: 32px 36px 40px;
    border-radius: 0;
  }
  .content-grid {
    flex-direction: row;
    align-items: start;
    gap: 28px;
  }
  .col-left,
  .col-right {
    flex: 1;
    min-width: 0;
  }
}
```

Key points:
- `.app` widens to 1100px — the band naturally fills the wider container
- `.band` gets more horizontal padding so text isn't too close to the edge
- `.sheet` drops its rounded top corners (the mobile "card peeling up" effect looks odd at full desktop width) and gets more padding
- `.content-grid` switches from `flex-direction: column` to `row` — the two child divs become side-by-side columns
- `flex: 1; min-width: 0` on each column ensures equal width and prevents overflow on long content

- [ ] **Step 3: Verify locally**

```bash
npm run dev
```

Open `http://localhost:5173/silvi-cycle-tracker/` and:
1. At full laptop width (≥ 900px): confirm band spans full width, two equal columns appear below it (left: phase ring + mood; right: weight card + 14-day strip + calendar)
2. Shrink browser to < 900px: confirm single-column mobile layout is unchanged
3. Confirm cards have 20px gaps between them in both layouts

- [ ] **Step 4: Build to verify no errors**

```bash
npm run build
```

Expected output ends with `✓ built in ...` — no errors.

- [ ] **Step 5: Commit and push**

```bash
git add src/index.css
git commit -m "Add desktop two-panel layout at 900px+"
git push
```
