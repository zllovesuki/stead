# Stead

Stead is a proof of concept for a personal agent workspace on Cloudflare. Hand
off a task, keep talking, and come back to the same conversation and saved work.

Ask it to research a question, work through a dataset, or make a small interactive
artifact. Each task has its own workspace, files, and activity. Open a result,
download it, or give the task a new direction without losing the rest of your work.

Personal notes carry preferences and decisions between tasks. A scheduled
responsibility can revisit a public topic while you're away.

Built end to end in about two hours with GPT-6 Astra (max reasoning, Fast mode)
and parallel subagents. Read the [session retrospective](RETROSPECTIVE.md).

## What it demonstrates

Stead explores the persistent-assistant experience of Dots and Muse using
Cloudflare's agent and execution infrastructure. Inference runs on Workers AI;
public search uses Exa.

This proof of concept serves one operator. Tasks can run independently, but
interrupted work may need an explicit **Resume**. A correction pauses its task
before continuation; stopping work cannot undo an operation already underway.
Files saved before an interruption remain available.

Execution supports bounded JavaScript and self-contained HTML previews. General
browser automation and a native Linux environment are outside the current scope.

## Working on Stead

The [development guide](IMPLEMENTATION.md) covers local setup, checks, deployment,
and the ownership boundaries that matter when changing the application.
