# Working on Stead

## Local development

Use the Node and pnpm versions declared in [package.json](package.json). Install
dependencies with lifecycle scripts disabled:

```sh
pnpm install --ignore-scripts
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

Set `PREVIEW_TOKEN` to a long random application password. It admits the single
operator and signs the browser session. Keep it separate from Cloudflare API
credentials. Local configuration, runtime data, and `.local/` are ignored.

Authenticate Wrangler to your Cloudflare account. Create a project-owned AI
Gateway with authentication and unified billing enabled, then set `GATEWAY_ID`
in [wrangler.jsonc](apps/server/wrangler.jsonc). Configure a Gateway spend limit
appropriate to your usage; scheduled work can incur charges while the browser is
closed. Normal development uses real inference and search.

```sh
pnpm dev
```

Open the Vite address and sign in with `PREVIEW_TOKEN`. Development state stays
under `apps/server/.wrangler/state`. Incompatible preview schema changes may
require resetting that local state.

## Changes and checks

```sh
pnpm types
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm build
```

Regenerate Worker types when bindings change. Runtime tests exercise the actual
actors and computer execution with a deterministic model. Browser tests use a
development-only model substitution and separate local state; neither suite
requires AI credits. Install Playwright's browser with
`pnpm exec playwright install chromium` when needed.

Run checks relevant to the affected behavior. Model quality and platform behavior
that depends on hosting need a separate, bounded live test. Keep disposable
research and live-test output under `.local/`; they are not application inputs.

## Ownership

The personal agent owns conversation continuity, task identity, notes, and
responsibility routing. Each retained task owns its instructions, corrections,
execution, and outcome. The UI reads task state from that owner. A completed model
turn or a healthy connection does not establish that the task fulfilled its goal.

Think and computer share one filesystem per task. Publication checks the saved
result after earlier workspace operations finish. It establishes that the result
exists, not that its contents are factually correct. Partial files survive failed
execution; recovery reuses those files and requires explicit continuation.

The client owns interaction state and consumes the browser-safe contracts package.
Think owns the conversation stream; TanStack Query owns ordinary server reads.
Avoid introducing a second store for the same live state. Tailwind utilities
compose the UI, with shared tokens and controls in `packages/ui`.

Application modules import shared packages through their declared exports.
`@/…` resolves client source; `@/server/…` resolves server source. Client-owned
Vite assembles both applications into one deployment. Keep platform capabilities
out of browser contracts and generated code. Limits belong in the executable
schemas, tools, and runtime configuration that enforce them.

## Deployment

Use a Worker and Gateway owned by this project. Review the target account and
bindings before deploying; no existing application storage is needed.

```sh
pnpm build
pnpm exec wrangler deploy --config apps/client/dist/stead_preview/wrangler.json
pnpm exec wrangler secret put PREVIEW_TOKEN --config apps/server/wrangler.jsonc
```

The build does not deploy. The application fails closed until the preview
password is configured. Rotating that secret invalidates subsequent HTTP/session
admission; an already-open agent connection can remain usable until it disconnects.

Generated HTML runs in an opaque-origin iframe that cannot read the parent
document or application storage. Its content security policy blocks fetches and
external subresources. Scripts can still navigate the frame itself: the
[iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox)
does not provide a complete network boundary.
