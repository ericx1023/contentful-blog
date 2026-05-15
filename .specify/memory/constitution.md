<!--
SYNC IMPACT REPORT
==================
Version change: TEMPLATE (uninitialised) → 1.0.0
Bump rationale: Initial ratification — template placeholders replaced with concrete
principles agreed by the project owner. Treated as MAJOR baseline (1.0.0) per
semantic versioning since this is the first governed version.

Language note: Per project convention, communication, code reviews, and most
.md files are written in Traditional Chinese (zh-Hant-TW). This constitution is
intentionally kept in ENGLISH as an explicit exception — it functions as a
machine-readable governance contract consumed by the spec-kit toolchain and
benefits from a stable, ASCII-only canonical form. The exception is documented
under "Communication & Language" below.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Clarity Over Cleverness
  - [PRINCIPLE_2_NAME] → II. Minimum Viable Complexity
  - [PRINCIPLE_3_NAME] → III. Library-First Architecture
  - [PRINCIPLE_4_NAME] → IV. Test-Driven Development (SHOULD)
  - [PRINCIPLE_5_NAME] → V. Structured Logging & Traceable Metrics
  - (added)            → VI. Intent-Driven Development

Added sections:
  - Additional Constraints (replaces SECTION_2)
  - Development Workflow & Quality Gates (replaces SECTION_3)

Removed sections: none (all template placeholders resolved)

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md  — Constitution Check section is
        compatible; gate content is filled at plan time, no template edit needed.
  - ✅ .specify/templates/spec-template.md  — No direct coupling to constitution
        content; no update required.
  - ✅ .specify/templates/tasks-template.md — Already includes logging and
        testing task examples consistent with Principles IV and V.
  - ⚠ CLAUDE.md — Consider adding a short summary of the communication
        convention ("zh-Hant-TW for prose, English for code, English for the
        constitution") to the project CLAUDE.md in a follow-up commit.

Deferred / TODOs: none. RATIFICATION_DATE uses today's adoption date 2026-05-14.
-->

# Contentful Blog Project Constitution

This constitution is the supreme working contract for the `contentful-blog`
project (Next.js + Contentful CMS + Isso comments + RSS ingestion pipeline).
All specs, plans, tasks, and code changes MUST comply with the principles
below.

## Core Principles

### I. Clarity Over Cleverness

Readability outweighs micro-optimisation and syntactic cleverness.

- Code MUST optimise for "the next reader understands the intent within 30
  seconds."
- Names MUST state intent directly; cryptic abbreviations and single-letter
  variables are not accepted (loop indices and similar conventional uses are
  exempt).
- Premature optimisation is forbidden; readability may only be traded for
  performance when a benchmark or production metric proves a real bottleneck.
- Comments SHOULD explain WHY, not WHAT (well-named identifiers handle the
  latter).

Rationale: this project is operated by a single maintainer (LaunchAgent
schedules, Isso, RSS pipeline included). Long-term cost is dominated by
"future me reading past me." Readability is a long-term productivity
multiplier.

### II. Minimum Viable Complexity

Adopt the simplest approach that works; raise complexity only with evidence.

- New features MUST start with the simplest design that satisfies the
  requirement. Adding abstractions, design patterns, queues, or caches MUST be
  backed by concrete evidence (traffic, latency, error rate).
- Three similar lines of code beat one premature abstraction.
- YAGNI (You Aren't Gonna Need It) is the default stance; speculative
  extensibility MUST be named in the plan.md `Complexity Tracking` table along
  with the simpler alternative that was rejected and why.
- Any PR that violates this principle MUST include a Complexity Tracking entry
  in its description.

Rationale: the historical migration from an n8n workflow on GCP to a single
Node script is concrete evidence — fewer moving parts means a smaller failure
surface.

### III. Library-First Architecture

Every feature MUST start life as a self-contained module or library.

- New features MUST first be designed as independently testable modules
  (e.g. `src/lib/<feature>/`, `scripts/<feature>/`) rather than being dropped
  inline under `pages/`.
- Modules MUST expose a clearly defined external API; internal details MUST be
  reached only via that API.
- Any code referenced in three or more places MUST be extracted into a shared
  module; copy-paste is not acceptable.
- Integrations with external services (Contentful, Isso, Telegram, Gemini)
  MUST be encapsulated in a single adapter/client module to keep mocking and
  replacement straightforward.

Rationale: `scripts/post-microdose/` is the canonical example — it owns its
own `package.json` and `node_modules`, fully decoupled from the Next.js app.
Future background processes and third-party integrations follow the same
pattern.

### IV. Test-Driven Development (SHOULD)

TDD is strongly recommended (SHOULD), not mandatory (NOT MUST).

- For new features, authors SHOULD write tests first, watch them fail, then
  implement until they pass.
- Core business logic — unified article transformation, RSS keyword filtering,
  Gemini translation post-processing, Contentful asset upload + rollback —
  SHOULD have unit tests covering the happy path and at least one error path.
- UI components MAY substitute visual verification (`/qa` or `/design-review`)
  as equivalent evidence.
- One-off scripts and exploratory prototypes MAY skip tests but SHOULD retain
  manually verifiable dry-run modes (e.g. `--test-telegram`,
  `--test-contentful`).

Rationale: this is a personal experimental project; mandatory TDD would crush
iteration speed. However, anything that runs automatically (e.g. the
LaunchAgent daily run) or publishes externally is too costly to leave
untested.

### V. Structured Logging & Traceable Metrics

Every service MUST emit structured logs and traceable metrics.

- Any long-running service (Next.js API routes, Isso, the RSS pipeline) MUST
  emit log lines that include a timestamp, level, and an operation identifier
  (correlation id or item id).
- Logs MUST NOT leak secrets, access tokens, Telegram chat id contents, or
  Contentful preview tokens; they MUST be masked or omitted.
- The RSS pipeline MUST record a per-item outcome category
  (`published` / `filtered` / `skipped` / `failed`) so runs can be audited
  after the fact.
- External API calls (Contentful, Gemini, Telegram, Readability) MUST log
  duration and success/failure. Consecutive failures MUST be surfaced in an
  alertable form (file, Telegram, or non-zero exit code).

Rationale: this project leans heavily on asynchronous background flows;
without traceable logs, debugging becomes impossible. The keychain CA bundle
issue was diagnosed precisely because the logs were structured.

### VI. Intent-Driven Development

Every line of code MUST trace back to a user or business intent.

- Every PR / commit description MUST link to a spec, issue, or conversation
  context. "Drive-by cleanup" mixed into in-progress feature work is not
  acceptable.
- Dead code, commented-out code, and unused feature flags MUST be removed
  before merge; do not retain "we might need this later" cruft.
- Refactors MUST be committed separately from feature changes and MUST state
  the intent in the description (readability, performance, decoupling).
- Any change made "for consistency" MUST identify the existing implementation
  it aligns with.

Rationale: solo projects accumulate orphan code fastest. Intent traceability
ensures every line can justify its existence — and can be deleted decisively
when that justification disappears.

## Additional Constraints

### Tech Stack & Compatibility

- Runtime: Node.js v18+ (authoritative source: `.nvmrc`); macOS LaunchAgent
  is the background scheduling environment.
- Primary frameworks: Next.js (pages router, `pageExtensions: ['page.tsx', ...]`),
  Tailwind CSS, Contentful GraphQL SDK.
- Adding npm dependencies MUST pass a necessity review; prefer packages
  already present in the lockfile.
- Upgrades to primary frameworks (Next.js, React, Contentful SDK) MUST be
  treated as MAJOR changes — author a plan.md and a test plan before
  executing.

### Security & Privacy

- `.env`, `*-ca-bundle.pem`, Telegram tokens, and Contentful tokens MUST NOT
  be committed to version control; `.env.example` is a placeholder template
  only.
- Changes to Isso comments or CSP MUST be reviewed alongside
  `config/headers.js` and `src/pages/_app.page.tsx`.
- External user input (Isso comments, any future search field, etc.) MUST be
  treated as untrusted and pass through escaping plus the active Content
  Security Policy.

### Communication & Language

- Communication with the project owner, code reviews, and most `.md` files
  MUST use Traditional Chinese (zh-Hant-TW).
- Code identifiers, commit messages, PR titles, and API documentation MUST
  use English for tool compatibility.
- **Exception**: this constitution itself is written in English. It is a
  machine-readable governance contract consumed by the spec-kit toolchain
  (`.specify/`) and benefits from a stable, ASCII-only canonical form.
- When translating RSS content, "psychedelic" MUST be rendered as
  「啟靈藥／啟靈」, not 「迷幻藥／迷幻」 (see user memory
  `feedback_psychedelic_term`).

## Development Workflow & Quality Gates

### Pre-commit Checks

- `yarn type-check` MUST pass.
- `yarn lint` MUST pass.
- Edits to GraphQL `.graphql` files MUST be paired with
  `yarn graphql-codegen:generate` and the resulting `src/lib/__generated/`
  changes MUST be committed.
- The pre-commit hook (husky + lint-staged) is a hard gate; `--no-verify` is
  not permitted.

### Spec-Kit Workflow Discipline

- Non-trivial changes (more than one file or any user-visible behaviour
  change) SHOULD flow through spec-kit: `/speckit-specify` →
  `/speckit-clarify` (if needed) → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`.
- The `Constitution Check` section in plan.md MUST verify each principle
  (I–VI). Violations MUST be named in the Complexity Tracking table with
  justification.
- tasks.md MUST mirror the prioritised user stories in spec.md; each story
  MUST be independently deliverable and independently testable.

### Code Review & Merging

- Merges into `main` MUST pass type-check and lint on a feature branch and
  MUST be exercised locally by the author at least once (UI changes SHOULD
  use `/qa` or a manual browser pass).
- Changes to the RSS pipeline or the LaunchAgent MUST be validated via
  `--test-telegram` / `--test-contentful` / `--dry-run` modes before
  promotion (see user memory `feedback_dry_run_before_broadcast`).
- Any change that will publish to Telegram or to Contentful production MUST
  preview the output in conversation before broadcast.

## Governance

- This constitution is the highest authority within the project, overriding
  individual PR descriptions, commit messages, and ad-hoc discussion.
- Amendment procedure: any addition, removal, or material semantic change to
  a principle MUST land via a PR that updates `Version`, `Last Amended`, and
  the Sync Impact Report.
- Semantic versioning:
  - MAJOR — remove a principle, redefine the semantics of a principle, or
    introduce an incompatible governance change.
  - MINOR — add a principle or materially expand guidance.
  - PATCH — wording polish, typo fixes, non-semantic clarifications.
- Compliance review: every `/speckit-plan` MUST reflect this constitution's
  principles in plan.md's `Constitution Check`; violations MUST be explained
  in Complexity Tracking.
- When this constitution conflicts with the project `CLAUDE.md` or with
  user-level memory, this constitution wins; the conflicting source SHOULD be
  reconciled in the next commit.

**Version**: 1.0.0 | **Ratified**: 2026-05-14 | **Last Amended**: 2026-05-14
