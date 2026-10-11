# Rate plans as individual JSON files

Rate plans live as individual JSON files (e.g., `data/plans/eversource-nh-r-tou.json`), imported at build time by Vite. Adding a rate plan means adding a file — no code changes. Each file is self-contained and reviewable in a PR. This maps to the broader RateMap vision of a git-versioned community dataset and provides a natural migration path if the data ever moves to an API.
