# MEMORY.md

## Goal
- Build a static responsive personal professional website on GitHub Pages with a Matrix-style background and a keyboard/mobile-touch snake game.

## Scope / Out of Scope
- In scope: static HTML/CSS/JS, responsive UI, Games menu, snake game, local high score, GitHub Pages deployment flow.
- Out of scope: backend, database, login, payments, unapproved external services, framework adoption, speculative content.

## Execution
- Mode: CODEX_FALLBACK
- Claude model: claude-sonnet-5
- Last test: PASS
- Detailed logs: AORR_LOG.md

## Current State
- Status: READY
- Completed loop: 4 - basic responsive shell scaffold
- Next loop: responsive layout polish and Games/gameboard scaffolding
- Retry: 0
- Fingerprint: none
- Blocker: none
- Last good commit / URL: none

## Acceptance
- Static site loads cleanly on desktop, tablet, and mobile.
- Menu includes Home, About, Projects, Contact, and Games.
- Matrix background stays green, animated, 0-F glyphs, reduced-motion aware.
- Snake game works with keyboard and mobile direction buttons, wall collision, pause, score save.

## Guardrails
- No unverified personal data generation.
- Do not delete existing content without explicit reason.
- Do not weaken or remove tests.
- Do not do large rewrites without need.
- Do not add backend, external services, or frameworks without approval.
- Do not print, log, code, document, or commit tokens.
- Keep detailed execution history in AORR_LOG.md, not here.

## Retry / HITL
- Max 3 retries per error.
- Same fingerprint twice means stop and escalate.
- One retry fixes one cause and only the related files.
- HITL is required for unclear content, deployment approval, or unresolved scope questions.

## Recent Loops
| Loop | Status | Mode / Model | Changed Files | Test Result | Retry | Next |
|---|---|---|---|---|---:|---|
| 2 | READY | CODEX_WORKER + CLAUDE_VERIFIER / claude-sonnet-5 | AORR.md | not run | 0 | TDD loop design |
| 3 | READY | CODEX_WORKER + CLAUDE_VERIFIER / claude-sonnet-5 | MEMORY.md | not run | 0 | repo skeleton |
| 4 | PASSED | CODEX_FALLBACK / claude-sonnet-5 | index.html, styles.css, script.js, MEMORY.md, AORR_LOG.md | PASS | 0 | content and gameboard expansion |
