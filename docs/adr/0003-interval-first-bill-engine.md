# Interval-first bill engine

The bill engine consumes an interval series — a sequence of {timestamp, kWh} records — and doesn't care whether they came from a synthetic archetype or an uploaded CSV/Green Button file. This replaces the prototype's representative-day approach (2 days per month, scaled by days-in-month), which can't process real customer data.

Archetypes now generate a full synthetic year of intervals rather than representative days. Uploaded data passes through as-is. Both paths produce the same input format, so the bill engine has one code path, not two.

## Considered Options

- **Representative days (prototype approach)**: Fast, good enough for synthetic archetypes, but fundamentally incompatible with real uploaded interval data. Would require two separate calculation paths.
- **Interval-first with source-agnostic input**: Single engine handles both archetypes and real data. More computation for archetypes (full year vs 24 representative days), but architecturally sound for the CSV/Green Button upload path.
