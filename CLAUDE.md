# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is not a software project — it currently contains a single Markdown reference document, written in Traditional Chinese:

- [task-schedule-method.md](task-schedule-method.md) — a personal task-scheduling decision framework. It defines four axes for classifying any task:
  - **A（期限 / deadline）**: A1 hard deadline, A2 self-imposed soft deadline, A3 no deadline
  - **B（型態 / mode）**: B1 cumulative/ongoing effort, B2 one-off
  - **C（依賴 / dependency）**: C1 blocks other people, C2 does not block others
  - **D（主導權 / ownership）**: D1 you own it, D2 joint decision, D3 you're a light participant

  The file is a 3×2×2×3 = 36-row lookup table mapping each A×B×C×D combination to a recommended strategy, plus a callout of 9 "logically conflicting" combinations (mostly C1 paired with A3 or D3) where the apparent lack of urgency/ownership is likely a misjudgment rather than reality.

There is no source code, build system, package manifest, test suite, or CI configuration in this repository. There is nothing to build, lint, run, or test.

## Working in this repository

- Treat `task-schedule-method.md` as a living reference document, not code. Edits should preserve its table structure (Markdown pipe tables) and existing terminology (the A/B/C/D letter-number codes like `A1B2C1D3` are used as stable identifiers throughout — don't rename them without updating every reference).
- Keep new content in Traditional Chinese to match the existing document, unless the user asks otherwise.
- If asked to extend the framework (e.g., add a new axis or new combinations), update both the relevant combination table(s) and the "邏輯衝突提醒" (logical conflict) section if the change introduces or removes a conflict case, and update the "使用提醒" summary count at the bottom if the number of ⚠️ combinations changes.
