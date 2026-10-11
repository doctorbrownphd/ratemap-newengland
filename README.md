# RateMap — New England Rate Explorer

A web-based rate explorer and bill calculator for New England utility customers, built for energy professionals and advisors.

**38 rate plans · 6 states · 11 utilities · All from official tariff PDFs**

## What it does

An energy advisor sits down with a customer. The customer wants to know: *which rate plan is cheapest for me? Should I switch to TOU? What happens if I get an EV? A heat pump? Solar?*

RateMap answers these questions with real data:

- **Calculator** — Pick a load profile (or upload real interval data), pick a utility and rate plan, and instantly see the annual bill, effective rate, bill composition, and how every available plan compares. TOU plans get a 24-hour clock visualization showing where load falls relative to peak/off-peak periods.

- **Catalog** — Browse all 38 rate plans across New England. Filter by state, utility, customer class, or rate structure. Inspect energy charges, customer charges, demand charges, net metering, and TOU period definitions. Every plan shows its source filing, verification date, confidence level, and provenance chain. Plans with historical data show a supply rate trend line.

## Rate data

Every rate in the app is sourced from official utility tariff PDFs, PUC filings, or verified regulatory data. No illustrative or estimated numbers.

| State | Utilities | Plans |
|---|---|---|
| Connecticut | Eversource CT, United Illuminating | 5 |
| Massachusetts | Eversource MA, National Grid, Unitil MA | 14 |
| Maine | Central Maine Power, Versant Power | 4 |
| New Hampshire | Eversource NH, Unitil NH | 9 |
| Rhode Island | Rhode Island Energy | 2 |
| Vermont | Green Mountain Power | 4 |

Rate plans include residential flat, residential TOU (2-period and 3-period), EV-specific rates, heat pump rates (with seasonal delivery), and commercial rates with demand charges. Each plan carries:

- `verifiedDate` — when the data was last verified against the source
- `confidence` — high (parsed from official PDF) or medium (web research)
- `obtainedVia` — full provenance chain describing how the data was obtained
- `rateHistory` — historical supply rates for trend visualization

Plans are individual JSON files auto-discovered at build time via Vite glob imports. Adding a new plan requires zero code changes — drop a JSON file in `src/data/plans/`.

## Features

### Bill calculation engine

- **Interval-first architecture** — the engine consumes a time-series of `{timestamp, kWh}` records and doesn't care whether they came from a synthetic archetype, a CSV upload, or a Green Button XML file
- **5 archetype load profiles** — typical home, electric-heat home (heat pump), EV household, solar home, small business
- **CSV upload** — drop hourly or 15-minute interval data; auto-detects resolution and format
- **Green Button XML** — parse ESPI/NAESB Atom feed format with Wh→kWh conversion
- **Seasonal rates** — heat pump plans have different delivery rates in winter vs summer
- **Tiered delivery** — supports inclining block rate structures (first X kWh at rate A, rest at rate B)
- **Demand ratchet** — optional minimum demand based on prior months' peaks
- **Net metering** — simplified 1:1 offset with seasonal-aware credit calculation
- **Federal holidays** — classified as off-peak for TOU billing

### Electrification comparison

When the electric-heat profile is selected, a panel appears for gas-to-heat-pump economics. The advisor enters the customer's current annual gas spend and sees:

- Current gas heating cost
- Gas customer charge eliminated
- Heat pump electric cost on the selected rate plan
- Net annual savings or additional cost

### Competitive supplier override

A supply rate input lets the advisor replace the default service rate with a competitive supplier or community aggregation rate. State-aware hints show the default rate and typical aggregation range (e.g., "Default: 15.6¢ · 13–15¢ aggregation typical" for MA). The override applies to all bill calculations including the plan comparison.

### Visualizations

All charts are custom SVG — no chart library dependency.

- **TOU Clock** — 24-hour radial dial showing load profile as a polar area fill inside colored TOU period arcs. Only shown for multi-period plans.
- **Period Band** — horizontal 24-hour chart with TOU period backgrounds and load curve overlay. Interactive hover tooltip. Dashed line for gross consumption when solar is present.
- **Comparison Bars** — vertical bar chart comparing annual bills across all plans for the same utility. Click to switch plans.
- **Monthly Bars** — 12-month stacked bar chart showing bill by component (supply, delivery, demand, fixed).
- **Sparkline** — mini line chart in catalog rows showing rate-by-hour profile.
- **Rate Trend** — supply rate history line chart in the catalog inspector.

### Deep-linkable URLs

All calculator state is in the URL: profile, utility, plan, month, day type, gas spend, and supplier override. Advisors can share a link that reproduces the exact view.

### Copy and share

- **Copy summary** — puts a plain-text bill comparison on the clipboard for pasting into client emails
- **Share URL** — copies the deep link

## Architecture

```
src/
├── engine/              Bill calculation, profiles, periods, CSV/GB parsers
│   ├── billing.ts       Interval-first bill engine with seasonal, tiered, ratchet support
│   ├── periods.ts       TOU classification, period segments, rate-by-hour facade
│   ├── profiles.ts      5 archetype generators, full-year interval synthesis
│   ├── constants.ts     Climate data, holidays, isOffPeak()
│   ├── csv.ts           CSV parser (auto-detect format and resolution)
│   └── greenbutton.ts   Green Button XML parser (ESPI/Atom)
├── data/plans/          38 JSON rate plan files (glob-imported, runtime-validated)
├── hooks/               React hooks for state and data
│   ├── useCalculatorState.ts   URL state management, plan validation
│   └── useIntervalData.ts      Interval sourcing, bill computation, comparison
├── screens/
│   ├── Calculator.tsx   Layout orchestration (~250 lines)
│   ├── Catalog.tsx      Rate plan browser with inspector
│   └── components/      Extracted subcomponents (ProfilePicker, BillBreakdown, ElectrificationPanel)
├── charts/              Custom SVG chart components (sealed interfaces, no engine dependency)
├── components/          Shared UI primitives (Icon, Logo, Btn, Card, Badge, Stat, etc.)
├── types/               Domain types (RatePlan, BillResult, IntervalSeries, etc.)
└── utils/               Formatting helpers
```

### Key design decisions (see `docs/adr/`)

1. **Vite + React as a static SPA** — no SSR needed for a client-side calculator tool
2. **Tailwind with custom design tokens** — design language from the prototype, mapped into Tailwind config
3. **Interval-first bill engine** — single code path for archetypes and real uploaded data
4. **Rate plans as individual JSON files** — adding a plan is a data change, not a code change

## Tech stack

- [Vite](https://vite.dev/) — build tooling
- [React 19](https://react.dev/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — strict mode
- [Tailwind CSS 4](https://tailwindcss.com/) — styling with custom design tokens
- [React Router](https://reactrouter.com/) — deep-linkable routing
- IBM Plex Sans / Mono — typography

No chart library. No state management library. No CSS-in-JS. No server.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## Adding a rate plan

Create a JSON file in `src/data/plans/`:

```json
{
  "id": "utility-ratecode",
  "utility": "Utility Name ST",
  "operatingCompany": "Legal Entity Name",
  "eiaId": "12345",
  "state": "ST",
  "name": "Rate X · Description",
  "rateCode": "X",
  "customerClass": "residential",
  "periodStructure": "flat",
  "hasDemand": false,
  "effectiveDate": "2026-06-01",
  "periods": { "flat": { "hours": [0, 24], "weekendsOff": false } },
  "rates": { "flat": { "supply": 0.12345, "delivery": 0.12345 } },
  "fixedCharge": 10.00,
  "demandRate": 0,
  "netMetering": "simplified",
  "source": "Utility · Filing Reference",
  "verifiedDate": "2026-06-01",
  "confidence": "high",
  "obtainedVia": "pdf-parse · source-url.pdf"
}
```

Rebuild. The glob import discovers it automatically.

## License

Apache-2.0. See [LICENSE](LICENSE).
