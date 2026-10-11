"""
report.py — HTML review report generator for tariff PDF extractions.

Produces a self-contained HTML file (Tailwind CDN) showing each extracted plan
with field values, source quotes, confidence badges, and validation status.
"""

import json
from datetime import date
from html import escape
from pathlib import Path


def _confidence_badge(confidence: str) -> str:
    """Return an HTML badge for the confidence level."""
    colors = {
        "high": ("bg-emerald-100 text-emerald-800", "HIGH"),
        "medium": ("bg-amber-100 text-amber-800", "MEDIUM"),
        "low": ("bg-red-100 text-red-800", "LOW"),
    }
    cls, label = colors.get(confidence, ("bg-stone-100 text-stone-600", confidence.upper() if confidence else "?"))
    return f'<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {cls}">{label}</span>'


def _validation_icon(status: str) -> str:
    """Return an HTML icon for the validation status."""
    icons = {
        "pass": '<span class="text-emerald-600 font-bold" title="Pass">&#10003;</span>',
        "warn": '<span class="text-amber-500 font-bold" title="Warning">&#9888;</span>',
        "fail": '<span class="text-red-600 font-bold" title="Fail">&#10007;</span>',
    }
    return icons.get(status, "")


def _format_value(value) -> str:
    """Format a value for display."""
    if value is None:
        return '<span class="text-stone-400 italic">null</span>'
    if isinstance(value, bool):
        return f'<code class="text-sm">{"true" if value else "false"}</code>'
    if isinstance(value, (int, float)):
        return f'<code class="text-sm">{value}</code>'
    if isinstance(value, str):
        return f'<code class="text-sm break-all">{escape(value)}</code>'
    if isinstance(value, (dict, list)):
        formatted = json.dumps(value, indent=2)
        return f'<pre class="text-xs bg-stone-50 rounded p-2 overflow-x-auto max-h-40">{escape(formatted)}</pre>'
    return f'<code class="text-sm">{escape(str(value))}</code>'


def _field_row(field_name: str, value, evidence: dict | None, validation: dict | None) -> str:
    """Render a single field row in the plan card."""
    source_quote = ""
    confidence = ""
    page = ""

    if evidence:
        if evidence.get("source_quote"):
            sq = escape(str(evidence["source_quote"]))
            source_quote = f'<blockquote class="mt-1 pl-3 border-l-2 border-stone-300 text-xs text-stone-500 italic">{sq}</blockquote>'
        confidence = _confidence_badge(evidence.get("confidence", ""))
        if evidence.get("page"):
            page = f'<span class="text-xs text-stone-400 ml-2">p.{evidence["page"]}</span>'

    val_icon = ""
    val_msg = ""
    val_row_class = ""
    if validation:
        val_icon = _validation_icon(validation["status"])
        if validation["status"] != "pass":
            val_msg = f'<span class="text-xs text-stone-500 ml-1">{escape(validation["message"])}</span>'
        if validation["status"] == "fail":
            val_row_class = " bg-red-50"
        elif validation["status"] == "warn":
            val_row_class = " bg-amber-50"

    return f"""\
      <tr class="border-t border-stone-200{val_row_class}">
        <td class="py-2 px-3 font-mono text-sm text-stone-700 align-top whitespace-nowrap">{escape(field_name)}</td>
        <td class="py-2 px-3 align-top">
          {_format_value(value)}
          {source_quote}
        </td>
        <td class="py-2 px-3 align-top text-center">{confidence}{page}</td>
        <td class="py-2 px-3 align-top text-center">
          {val_icon}
          {val_msg}
        </td>
      </tr>"""


# Top-level fields to display in order
_FIELD_ORDER = [
    "id", "utility", "operatingCompany", "eiaId", "state",
    "name", "rateCode", "customerClass", "periodStructure",
    "hasDemand", "effectiveDate", "effectiveThrough",
    "periods", "rates", "seasonalRates",
    "fixedCharge", "demandRate", "demandRatchet",
    "exportCredit",
    "deliveryComponents",
    "supplySchedule", "rateHistory",
    "source", "sourceUrl", "verifiedDate", "confidence", "obtainedVia",
]


def _plan_card(
    index: int,
    plan: dict,
    evidence: dict,
    validation_results: list[dict],
) -> str:
    """Render a single plan card."""
    plan_id = plan.get("id", f"plan-{index + 1}")
    rate_code = plan.get("rateCode", "?")
    name = plan.get("name", "")
    utility = plan.get("utility", "")

    # Build validation lookup by field
    val_by_field = {}
    for v in validation_results:
        val_by_field[v["field"]] = v

    # Count statuses
    passes = sum(1 for v in validation_results if v["status"] == "pass")
    warns = sum(1 for v in validation_results if v["status"] == "warn")
    fails = sum(1 for v in validation_results if v["status"] == "fail")

    # Status pill
    if fails > 0:
        status_pill = f'<span class="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">{fails} fail</span>'
    elif warns > 0:
        status_pill = f'<span class="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">{warns} warn</span>'
    else:
        status_pill = '<span class="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">all pass</span>'

    # Render fields
    rows = []
    rendered_fields = set()

    for field in _FIELD_ORDER:
        if field in plan or field in evidence:
            rows.append(_field_row(
                field,
                plan.get(field),
                evidence.get(field),
                val_by_field.get(field),
            ))
            rendered_fields.add(field)

    # Any extra fields not in the standard order
    for field in sorted(plan.keys()):
        if field not in rendered_fields:
            rows.append(_field_row(
                field,
                plan.get(field),
                evidence.get(field),
                val_by_field.get(field),
            ))

    rows_html = "\n".join(rows)

    return f"""\
    <div class="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
      <div class="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-stone-800">
            {escape(utility)} &mdash; {escape(rate_code)}
            <span class="text-stone-400 font-normal text-sm ml-2">{escape(plan_id)}</span>
          </h2>
          <p class="text-sm text-stone-500">{escape(name)}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-stone-400">{passes} pass &middot; {warns} warn &middot; {fails} fail</span>
          {status_pill}
        </div>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-stone-500 uppercase tracking-wide">
            <th class="py-2 px-3 w-48">Field</th>
            <th class="py-2 px-3">Value &amp; Source</th>
            <th class="py-2 px-3 w-28 text-center">Confidence</th>
            <th class="py-2 px-3 w-28 text-center">Validation</th>
          </tr>
        </thead>
        <tbody>
{rows_html}
        </tbody>
      </table>
    </div>"""


def generate_review_report(
    extractions: list[dict],
    validation_results: list[list[dict]],
    source_display: str,
    model_name: str,
    output_path: Path,
) -> None:
    """Generate the full HTML review report."""
    today = date.today().isoformat()

    # Aggregate stats
    total_pass = sum(sum(1 for v in vr if v["status"] == "pass") for vr in validation_results)
    total_warn = sum(sum(1 for v in vr if v["status"] == "warn") for vr in validation_results)
    total_fail = sum(sum(1 for v in vr if v["status"] == "fail") for vr in validation_results)
    plan_count = len(extractions)

    # Summary status
    if total_fail > 0:
        summary_class = "border-red-300 bg-red-50"
        summary_icon = '<span class="text-2xl">&#10007;</span>'
        summary_text = f"{total_fail} validation failure(s) require attention"
    elif total_warn > 0:
        summary_class = "border-amber-300 bg-amber-50"
        summary_icon = '<span class="text-2xl">&#9888;</span>'
        summary_text = f"{total_warn} warning(s) to review"
    else:
        summary_class = "border-emerald-300 bg-emerald-50"
        summary_icon = '<span class="text-2xl">&#10003;</span>'
        summary_text = "All validations passed"

    # Build plan cards
    cards = []
    for i, extraction in enumerate(extractions):
        plan = extraction.get("plan", extraction)
        evidence = extraction.get("evidence", {})
        vr = validation_results[i] if i < len(validation_results) else []
        cards.append(_plan_card(i, plan, evidence, vr))

    cards_html = "\n\n".join(cards)

    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RateMap Extract Review &mdash; {escape(source_display[:80])}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {{ font-family: 'Inter', system-ui, -apple-system, sans-serif; }}
    @media print {{
      .no-print {{ display: none; }}
      body {{ font-size: 10px; }}
    }}
  </style>
</head>
<body class="bg-stone-100 text-stone-900 min-h-screen">

  <!-- Header -->
  <header class="bg-white border-b border-stone-200 shadow-sm">
    <div class="max-w-6xl mx-auto px-6 py-4">
      <h1 class="text-xl font-bold text-stone-800">RateMap Extraction Review</h1>
      <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-500">
        <span>Source: <span class="font-mono text-stone-700">{escape(source_display[:120])}</span></span>
        <span>Model: <span class="font-mono text-stone-700">{escape(model_name)}</span></span>
        <span>Date: <span class="font-mono text-stone-700">{today}</span></span>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 py-8 space-y-8">

    <!-- Summary banner -->
    <div class="rounded-lg border-2 {summary_class} px-6 py-4 flex items-center gap-4">
      {summary_icon}
      <div>
        <p class="font-semibold text-stone-800">{summary_text}</p>
        <p class="text-sm text-stone-600 mt-1">
          {plan_count} plan(s) extracted &middot;
          {total_pass} pass &middot;
          {total_warn} warning(s) &middot;
          {total_fail} failure(s)
        </p>
      </div>
    </div>

    <!-- Instructions -->
    <div class="bg-white rounded-lg border border-stone-200 px-6 py-4 text-sm text-stone-600 no-print">
      <p class="font-medium text-stone-700 mb-1">Review workflow</p>
      <ol class="list-decimal list-inside space-y-1">
        <li>Check each field's source quote against the original PDF</li>
        <li>Resolve any <span class="text-red-600 font-medium">FAIL</span> validations (missing required fields, bad formats)</li>
        <li>Investigate <span class="text-amber-600 font-medium">WARN</span> items (mismatched sums, unusual values)</li>
        <li>Edit the draft JSON in <code class="bg-stone-100 px-1 rounded">drafts/</code>, then copy approved files to <code class="bg-stone-100 px-1 rounded">src/data/plans/</code></li>
        <li>Update <code class="bg-stone-100 px-1 rounded">obtainedVia</code> to <code class="bg-stone-100 px-1 rounded">human-verified: true</code></li>
      </ol>
    </div>

    <!-- Plan cards -->
{cards_html}

  </main>

  <footer class="max-w-6xl mx-auto px-6 py-6 text-center text-xs text-stone-400">
    Generated by ratemap-extract on {today} &middot;
    <span class="font-medium">Draft &mdash; requires human verification before use</span>
  </footer>

</body>
</html>"""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(html)
