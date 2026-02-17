# Scratchpad mobile UX review and recommendation

## What the app does today

From the lesson page layout, opening scratchpad/chat on mobile renders the aside as a full-screen fixed overlay (`fixed inset-0 z-50`), while desktop switches to a side pane (`md:relative md:w-2/5 lg:w-1/2`). This is why lesson content disappears on narrow screens.

Relevant implementation details:

- The lesson content container becomes a flex split when scratchpad/chat is open.
- On mobile (`< md`), the aside is full-screen overlay.
- On desktop (`md+`), the aside participates in left-right split width.

## Best enhancement for current architecture

### Recommended: bottom-sheet scratchpad on mobile + keep current side split on desktop

This is the lowest-risk, industry-standard evolution of your existing design:

1. **Mobile (`< md`)**
   - Replace full-screen overlay aside with a bottom sheet that supports:
     - collapsed/peek state (e.g., 20-30% height)
     - half state (around 50-60%)
     - expanded state (90-100%)
   - Keep lesson visible behind the sheet in peek/half states.
   - Preserve the current close action and save behavior.

2. **Tablet/Desktop (`md+`)**
   - Keep the current side split behavior.
   - Optional follow-up: add draggable width between lesson and scratchpad.

3. **Inside Scratchpad panel**
   - Keep existing Write/Preview/Split tabs.
   - On very small heights (keyboard open), force default tab to `write` instead of internal `split` to reduce vertical crowding.

## Why this is the best fit (pros/cons)

### Pros

- **Aligns with existing architecture**: only mobile aside wrapper behavior changes; scratchpad internals can remain mostly intact.
- **Preserves context**: lesson remains visible, reducing read/write context switching.
- **Familiar pattern**: bottom sheets are common in modern mobile apps.
- **Incremental rollout**: can ship in stages (sheet first, snap points/drag polish later).

### Cons

- Requires careful handling for keyboard + sheet snap points.
- Gesture interactions need tuning to avoid accidental close/drag while editing.
- Slightly more complex than simple tab toggle.

## Alternatives considered

### A) Top-bottom fixed split on mobile
- **Pros**: always shows lesson and scratchpad simultaneously.
- **Cons**: cramped when keyboard is open; harder to provide enough space for equations and preview.

### B) Full toggle (Lesson/Scratchpad tabs)
- **Pros**: simplest implementation.
- **Cons**: maximal context switching; worse for solving while referencing text.

### C) Keep full-screen scratchpad as-is
- **Pros**: no engineering work.
- **Cons**: repeats current pain point where lesson disappears entirely.

## Suggested implementation sequence

1. Introduce a reusable `MobileBottomSheet` wrapper for lesson aside when `scratchpadOpen || chatSidebarOpen` and viewport `< md`.
2. Keep existing desktop aside classes untouched.
3. Add E2E checks for:
   - mobile: lesson remains partially visible when scratchpad opens
   - mobile: expand to full and collapse back
   - desktop: current side-split still works
4. Add keyboard-specific behavior (on focus in editor, snap to expanded).

## Success criteria

- Opening scratchpad on mobile does **not** fully remove lesson from view by default.
- User can quickly switch between reference (lesson) and writing (scratchpad) without hard mode switches.
- No regression to desktop side-split experience.
