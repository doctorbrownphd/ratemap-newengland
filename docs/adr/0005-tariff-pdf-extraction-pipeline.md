# Tariff PDF extraction pipeline

A CLI tool that takes a tariff PDF (URL or local path) and produces draft Rate Plan JSON files with a mandatory human verification step. The LLM extracts structure and maps fields to the RatePlan schema; a deterministic validation layer checks every number; an HTML review report shows each field alongside its source quote, confidence, and validation status.

Design principles from external review: "the deterministic engine stays the source of truth for every dollar figure" and "ML shapes inputs, never produces the billed number." The extraction pipeline is the one place where LLM involvement is genuinely high-leverage — it turns keeping 38+ plans current from heroic manual effort into routine review.

## Key decisions

- **CLI-first** (`ratemap extract <url-or-path>`), designed so a CI/CD pipeline or admin UI can call the same extraction function later.
- **Accepts URL or file path** — fetches and extracts in one step.
- **Always outputs an array** of plan files (tariff PDFs are multi-plan documents). `--rate-code` filters to one.
- **LLM extracts structure, deterministic validates** — the LLM maps document content to schema fields with source quotes; validation checks sums, ranges, and types. Numbers are never invented.
- **Model-configurable** — ships with Claude API as default, swappable via env var (`RATEMAP_MODEL=claude|openai|ollama`).
- **HTML review report** (`--review`) — each field shows value, source quote with page/line, confidence (high/medium/low), and validation status (pass/mismatch/missing). Human focuses on red flags.
- **Output goes to `drafts/`** — not directly into `src/data/plans/`. Human moves approved files after review.

## Considered alternatives

- **Deterministic table extraction only** (tabula/camelot + no LLM): Too fragile — tariff layouts vary wildly across utilities, and the same data appears as tables in one filing and prose in another.
- **Admin UI in the web app**: Worth building eventually, but couples data maintenance to the customer-facing app and requires backend infrastructure. CLI + HTML report achieves the same trust properties with zero infrastructure.
