# Building Stead

Stead began with a product question: could a Dots/Muse-style persistent personal
agent run on Cloudflare? The useful interpretation was concrete. Hand off work,
keep talking to the same assistant, inspect its results, redirect a task, and
return later without losing the conversation or saved files. Producing an app or
report mattered because it demonstrated that loop.

The result is a single-operator proof of concept. Cloudflare hosts the
application, agent state, isolated execution, and model inference through Workers
AI's GLM model; public search uses Exa. It explores a similar experience without
claiming access to those products' proprietary implementations, equivalent model
quality, or security parity.

## Choose the uncertainty before the architecture

The first useful work was reading neighboring projects and testing the uncertain
boundaries. Vaskel, bland, anvil, and git-on-cloudflare supplied experience with
state ownership, browser contracts, recovery, and the distinction between saved
bytes and accepted results. Their mechanisms were relevant; their complete
product models were not necessary.

[Cloudflare OS](https://github.com/cloudflare/cloudflare-os/tree/4f55124087d1525528697bdfdde1f15f83de740d)
deserved particular attention. It already combined agents,
durable work, generated applications, and an integrated workspace. Initially, a
thin customization looked plausible. At the revision inspected, its stock
conversation flow did not supply the always-available personal
coordinator, and its browser binding did not establish general browser
automation. Adopting it would still leave the defining assistant behavior to
build, while introducing a different runtime and workpiece model. It remained a
useful reference and a credible alternative for a product centered on persistent
generated applications.

Three small probes distinguished plausible architecture from working
capability: real model/tool execution, durable files with isolated JavaScript,
and independent foreground/background work with recovery. Pinning compatible
Think, Agents, computer, and AI SDK versions made the findings actionable.
Gateway metering for these initial experiments on October 9, 2026 was about
1.78 cents for inference and search; that excludes the coding session and other
platform charges. The value was the decisions they enabled: keep the existing
harness, use bounded JavaScript, and expose manual recovery instead of building a
custom scheduler or assuming automatic continuation.

## Parallel work still needs shared boundaries

Contracts, runtime, workspace tools, and frontend could progress in parallel
because their responsibilities were explicit. The personal agent owns the
conversation and task identities. Retained child agents own task execution and
outcomes. Think and computer share one filesystem per task through their existing
integration seam, so tool reads and executed programs see the same files.

The React frontend uses Tailwind v4 utilities in a four-package pnpm workspace,
with declared package exports and source aliases keeping imports legible.
Conversation traffic uses the SDK's WebSocket stream; task and file views use
ordinary queries and polling. That choice delivered visible progress without
inventing another event protocol or duplicating authoritative task state.

The build took about two hours. The main coding session used GPT-6 Astra with
max reasoning in Fast mode, supported by parallel subagents. Delegation let these
areas progress at the same time; integration remained an active job. Human steering
kept the persistent-assistant experience central and pushed for modularity and
useful documentation. Orchestration and review reconciled interfaces and tested
whether the assembled application preserved the intended behavior.

## The failures that changed the implementation

The most consequential integration failure was concurrency. In the combined
application, starting retained children through `runTurn` with `mode: "submit"`
serialized work that was supposed to run independently. A test held two task model
calls open and asked the main
conversation another question. That exposed the difference between having child
agents and giving them independent execution lifetimes. Switching to the SDK's
`startAgentToolRun` on retained facets supplied independent `keepAliveWhile`
execution and restored the interaction.

Another failure belonged to the test fixture. Shared promises crossed workerd
I/O contexts, invalidating the attempted model hold. Moving controlled waiting
into a dedicated test-only Durable Object made the experiment valid. Treating
that as a product defect would have sent the implementation in the wrong
direction.

The probes also established a durable distinction: SDK turn completion does not
mean the requested task is complete. After eviction, a turn could finish without
its expected artifact. Stead therefore records an explicit task outcome and
offers Resume against retained state. Failed execution can leave useful files
behind; recovery preserves them rather than pretending the operation rolled
back.

Review found a related publication race. A model can request parallel tools, so
publication could inspect a file while another operation changed it. Task tool
operations now run in sequence, and completed files cannot be overwritten until
a correction reopens the task. Publication checks for an existing, nonempty
result. It establishes a saved output, not the factual truth of its contents.

Live model behavior reinforced the value of recovery. The first three
JavaScript attempts failed on module conventions, including a top-level return
and `fs/promises` instead of `node:fs/promises`. The model used the errors to
correct its program and finish. That is useful evidence of a recoverable tool
loop, not a polished first attempt.

## What it establishes

Hosted work produced a CSV analysis with sum 10 and count 3, delegated an
interactive counter from the main conversation that advanced from zero to one,
and saved research citing two official sources. Deterministic runtime tests
covered lifecycle behavior; browser checks exercised the user interaction.
These observations support the selected task families, not general autonomous
reliability.

Documentation needed correction too. The initial README read like a build
ledger. Separating the product introduction from the development guide made each
serve a reader. Security wording also became narrower: generated HTML cannot
read the parent document, and its policy blocks fetches and external subresources,
but scripts can navigate their own frame. Calling that complete network
isolation would overstate the boundary.

Stead now connects conversation, delegated tasks, saved artifacts, personal
notes, and scheduled responsibilities. Its concessions are deliberate: one
operator, bounded execution, explicit recovery, and limited HTML previews.
General browser control, native Linux workloads, unattended long-idle recovery,
and consequential external actions need their own evidence if they become
product requirements. The next useful question is whether repeated real use
makes the assistant's continuity valuable enough to justify those additions.
