# Vite + React as a static SPA

We chose Vite + React for the build setup over buildless CDN React (the prototype approach) and Next.js. The app is a client-side interactive tool with no SEO or server-rendering needs — Vite gives us ES modules, HMR, and static output without framework overhead. If a backend is needed later (e.g., Green Button Connect OAuth), it can be added as a separate API without rebuilding the frontend.

## Considered Options

- **Buildless (CDN React + Babel in-browser)**: Zero tooling but no modules, no tree-shaking, `window.*` globals everywhere. Doesn't scale past prototype.
- **Next.js**: SSR, routing, API routes built in — but all overhead we don't need for a purely client-side calculator/catalog tool.
