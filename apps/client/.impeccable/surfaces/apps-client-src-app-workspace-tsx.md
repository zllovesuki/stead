---
version: 1
slug: "apps-client-src-app-workspace-tsx"
primary_target: "apps/client/src/app/workspace.tsx"
related_targets:
  [
    "apps/client/src/features/chat/conversation.tsx",
    "apps/client/src/app/detail-pane.tsx",
  ]
---

# Personal workspace

Mode: Operate. One operator talks with a persistent assistant, delegates work, inspects files, adds context and redirects tasks. The main conversation and individual task state have independent lifetimes. Product authority: PRODUCT.md.

## Direction contract

THESIS: A useful personal workbench organized around a continuing conversation, with delegated work close at hand.

OWN-WORLD: Warm neutral surfaces, deep olive controls, fine dividers and compact utility chrome. A restrained serif wordmark and conversational empty states give the workbench its identity; task and file content use a familiar sans face.

STORY: Open the same conversation, hand off a piece of work, keep talking and inspect the result without losing context. Corrections, notes and scheduled work remain visible and editable.

FIRST VIEWPORT: A narrow task rail at left, a generous conversation in the center, and an optional detail pane at right. The composer stays at the bottom of the conversation; task controls stay in the detail pane. On mobile, task details occupy the main area with a clear return to conversation.

FORM: Code-led persistent workbench, selected by the authorized build brief. No generated reference comp or randomized seed. The characteristic interaction is opening task detail alongside the still-mounted main conversation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
