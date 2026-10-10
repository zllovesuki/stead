---
name: Stead
description: A warm, restrained personal workbench for continuing conversation and retained work.
colors:
  canvas: "#f5f4ef"
  surface: "#fffefa"
  rail: "#eeede6"
  hover: "#e7e7de"
  ink: "#282c24"
  muted: "#626659"
  line: "#dddfd2"
  accent: "#485c35"
  accent-hover: "#344727"
  accent-soft: "#e6eddd"
  on-accent: "#ffffff"
  warning: "#805923"
  warning-soft: "#f4e8cf"
  danger: "#9d3934"
  danger-soft: "#f8e7e2"
typography:
  display:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "1.5rem"
    fontWeight: 400
  title:
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 2
  label:
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
  control:
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  code:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: "0.75rem"
    lineHeight: "1.5rem"
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.875rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.875rem"
  button-quiet:
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.875rem"
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.875rem"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 0.75rem"
  badge-positive:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.5rem"
  navigation-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
  correction-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.3}"
  composer:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "{spacing.3}"
---

# Design System: Stead

## Overview

**Creative North Star: "The personal workbench"**

Stead uses warm neutral surfaces, deep olive controls, fine dividers and compact utility chrome. A restrained serif wordmark and conversational introductions provide identity; familiar system sans typography carries task and file content. The surface direction is recorded in `apps/client/.impeccable/surfaces/apps-client-src-app-workspace-tsx.md`.

This documents the implemented frontend. Tokens come from `packages/ui/src/theme.css`; shared controls come from `packages/ui/src/index.tsx`. Client styles and feature components supply layout and behavior. The interface ships no raster assets: its leaf mark and utility icons are SVG.

**Key Characteristics:**

- Warm neutral planes with olive actions.
- Serif introductions and compact sans utility text.
- Flat panels, fine dividers and modest rounded controls.
- Continuing conversation beside inspectable work.

## Colors

### Primary

Olive `accent` marks primary actions, links, the leaf symbol and positive task state. `accent-hover` deepens primary buttons on hover; `accent-soft` supports positive badges and text selection. `on-accent` supplies contrast on filled controls.

### Neutral

`canvas` supports the outer workspace, composer and inset content. `surface` holds conversation, details, fields and selected navigation. `rail` distinguishes navigation and code/table headers. `hover` marks quiet interactions and neutral badges. `ink` carries main text, `muted` secondary text, and `line` panel dividers and field borders.

### Semantic states

Amber `warning` on `warning-soft` marks work needing attention; red `danger` on `danger-soft` marks failures, alerts and removal confirmation. Each state has a written label. The palette has no separate decorative secondary accent or implemented dark theme.

## Typography

The frontmatter records the installed CSS stacks; no webfont download is used. Serif display introduces an empty conversation and the wordmark; serif headlines introduce task, notes and responsibility panels. Sans titles, labels and controls support scanning. Body prose uses the body role, while compact descriptions commonly use a shorter line height (1.5rem). Code and raw files use the mono stack.

The wordmark uses the display size with its default line height; mobile uses the headline size. Sign-in expands serif display to 3rem, then 3.75rem at the small breakpoint, with a line height of 1.12. Small metadata uses 0.6875rem; the preview marker uses 0.625rem. Markdown headings use sans sizes of 1.5rem, 1.25rem and 1rem at weight 600. Conversation text is capped at 42rem, with horizontal scrolling for wide code and tables.

## Layout

The workspace fills the dynamic viewport height. Its navigation rail, conversation and optional detail pane have independent scrolling areas. The conversation header is 4.5rem high; its composer remains below the scrolling transcript. Content gutters are 1.25rem, widening to 2rem at 40rem. Detail content uses 1.25rem padding, widening to 1.5rem at the same breakpoint. The spacing rhythm comes from Tailwind's 0.25rem base, with half steps for small icon and control gaps.

Below 48rem, a 3.5rem mobile header exposes a 16rem overlay rail. At 48rem the rail becomes persistent at 15rem; at 80rem it expands to 16rem. Below 64rem, an open detail pane occupies the main area and exposes a return-to-conversation control. The conversation remains mounted while hidden. At 64rem, conversation and detail sit beside one another: details use 23.75rem, expanding to 26.25rem at 80rem. File detail uses 44% of the workspace row, expanding to 48% at 96rem.

Sign-in stacks its introduction and form below 64rem, then uses two columns in a 1.05:1 ratio.

## Elevation & Depth

Surfaces use tonal layering and one-pixel dividers without box shadows. Selected rail items use the lighter surface plane. The mobile rail sits above a backdrop made from ink at 20% opacity. Focus uses an olive outline (2px) offset from the control (3px); the composer instead changes its enclosing border on focus within.

## Shapes

Buttons, fields, navigation rows, correction cards and alerts use the large radius. Badges and segmented options use the medium radius; the composer and user messages use the extra-large radius. Inline code uses the small radius. Tiny circular dots communicate status alongside text. SVG utility icons generally range from 13–19px; introductory leaf and section icons are larger and use lighter strokes.

## Components

### Buttons and fields

Shared buttons are at least 2.5rem high; icon buttons are 2.5rem square. Primary actions use olive, secondary actions use a surface fill with a line border, quiet actions use muted text, and destructive actions use the soft danger pair. Secondary hover uses canvas; quiet hover uses hover and ink; destructive hover uses danger with white text. Disabled buttons use 45% opacity and a not-allowed cursor. Fields have a line border, muted placeholders and 50% disabled opacity; textareas resize vertically where enabled.

Color transitions use 150ms with `cubic-bezier(0.4, 0, 0.2, 1)`. Busy state uses a spinning loader or pulsing dot; reduced-motion preference suppresses those animations and reduces transitions to 0.01ms. Icon controls have accessible labels; ordinary interactive elements receive the global focus treatment.

### Navigation, badges and content

Rail navigation has a minimum height of 2.75rem and a surface fill when selected. Task rows combine a title, status icon, written status and optional artifact count. Neutral badges use hover/muted; positive badges use the olive pair; warning and danger badges use their semantic pairs. Running and completed work share positive color but retain different labels and icons.

Notes and responsibilities are separated by dividers. Saved corrections use canvas cards with an explicit applied, pending or resume-required badge. File rows expose name, size and saved/published status. Markdown, CSV and raw code each receive their own reading treatment; HTML preview is an explicit viewer action.

### Conversation and state ownership

The composer has a canvas fill, line border and extra-large corners. Enter sends; Shift+Enter adds a line. A busy reply replaces send with a stop-reply control. Task stop/resume controls live in task detail, separately from reply controls. User messages use inset canvas bubbles; assistant prose rests directly on the surface.

TanStack Router search owns task, file and panel selection. TanStack Query owns ordinary workspace, task and file reads and their mutation refreshes. Agent chat owns the continuing conversation and recovery; component state owns drafts, local editors, the mobile rail and preview toggles. Connection status appears in the conversation header independently of task outcome. Errors appear inline with retry where provided; pending controls expose their action in progress. Opening a detail pane preserves the conversation instance and draft.

## Do's and Don'ts

### Do:

- Do reuse the shared theme and control variants.
- Do pair status color with readable labels and retain separate connection and task states.
- Do preserve the mounted conversation while navigating work and files.
- Do use the existing focus treatment and reduced-motion behavior.

### Don't:

- Don't turn reply completion or connection health into a completed-task signal.
- Don't replace explicit task resume with automatic resume when the workspace opens.
- Don't introduce a second visual system for notes, files or task controls.
