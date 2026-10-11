# RateMap New England

A web-based rate explorer and bill calculator for New England utility customers, built for energy professionals and advisors.

## Language

**Load Profile**:
A representation of electricity consumption (and optionally generation) over time, either a synthetic archetype or real interval data uploaded by the user.
_Avoid_: Usage pattern, demand curve, load shape

**Archetype**:
A pre-built synthetic load profile representing a customer type (e.g., EV household, solar home). Generates deterministic 15-minute interval data using weather and behavioral models.
_Avoid_: Template, sample profile, default profile

**Utility**:
A regulated electric distribution company identified by its brand name and jurisdiction (e.g., "Eversource NH"). The combination of brand + state is the primary grouping — not the parent holding company or the legacy operating company name.
_Avoid_: Operating company, provider, supplier

**Period Structure**:
How a rate plan's energy charges vary by time of day — `flat` (single period), `tou-2` (peak/off-peak), or `tou-3` (peak/mid-peak/super off-peak). Defined per plan, not globally, because different plans at the same utility can have different peak hours.
_Avoid_: Rate structure, time structure, TOU type

**Demand Charge**:
A charge based on the customer's peak kilowatt draw during a billing period, independent of energy consumed. A rate plan either has demand charges or it doesn't — this is orthogonal to period structure.
_Avoid_: Capacity charge, peak charge

**Export Credit**:
How a rate plan compensates solar (or other DER) exports. Five structural patterns: `netting-retail` (1:1 offset at full retail, excess carried at retail), `netting-reduced` (1:1 offset, net export credited below retail at a specified rate), `netting-two-rate` (1:1 offset at retail up to monthly imports, excess at a lower avoided-cost rate), `buyback` (all export purchased at a fixed tariffed rate, no netting), or `none`. Each rate plan specifies the pattern and the credit rate(s). Applied per state to all residential plans — export credit is a state policy overlay, not a rate-plan-specific feature.
_Avoid_: Net metering (ambiguous — means different things in each state), NEM, DER compensation

**Rate Plan**:
A specific combination of utility, rate code, period structure, charge components, and effective date — the complete set of rules needed to calculate a bill.
_Avoid_: Tariff, rate schedule, rate, plan

**Interval Series**:
A time-ordered sequence of metered or synthetic consumption records ({timestamp, kWh}), at 15-minute or hourly resolution. The universal input to the bill engine — source-agnostic.
_Avoid_: Load data, usage data, meter data

**Gas Rate**:
A natural gas volumetric rate in $/therm, used for electrification comparison — showing what a customer currently pays for gas heating vs what they'd pay on an electric heat pump rate. Not part of the LF Energy contribution.
_Avoid_: Fuel rate, heating rate

**Extraction**:
The process of converting a tariff PDF into a draft Rate Plan JSON. The LLM maps document content to schema fields with source quotes; a deterministic validation layer checks every number. Output is a draft — never committed without human review.
_Avoid_: Parsing (too generic), scraping (implies web), OCR (one step of many)

**Bill Result**:
The output of running a load profile against a rate plan — a 12-month breakdown of supply, delivery, demand, fixed charges, and net metering credits, with an annual total and effective rate.
_Avoid_: Invoice, calculation, estimate
