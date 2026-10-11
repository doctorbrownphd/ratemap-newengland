#!/usr/bin/env python3
"""
ratemap extract — Tariff PDF extraction CLI for RateMap New England.

Takes a tariff PDF (URL or local file), uses an LLM to extract rate plan data
into the RatePlan JSON schema, validates every field deterministically, and
produces draft JSON files + optional HTML review report.

Usage:
    python cli/extract.py https://unitil.com/.../NH-Residential-Electric-Rates.pdf
    python cli/extract.py ./local-tariff.pdf --output drafts/ --review
    python cli/extract.py tariff.pdf --rate-code R-1
    python cli/extract.py --list-models
"""

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

# ── Model configuration ───────────────────────────────────────────────

MODEL_CONFIGS = {
    "claude": {
        "api_base": "https://api.anthropic.com/v1/messages",
        "env_key": "ANTHROPIC_API_KEY",
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 8192,
    },
    "openai": {
        "api_base": "https://api.openai.com/v1/chat/completions",
        "env_key": "OPENAI_API_KEY",
        "model": "gpt-4o",
        "max_tokens": 8192,
    },
}

UA = {"User-Agent": "ratemap-extract/1.0"}

# ── Resolve project paths ─────────────────────────────────────────────

CLI_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CLI_DIR.parent
TYPES_PATH = PROJECT_ROOT / "src" / "types" / "index.ts"


def load_rateplan_schema() -> str:
    """Read the TypeScript RatePlan type definitions from src/types/index.ts."""
    if not TYPES_PATH.exists():
        print(f"  warning: {TYPES_PATH} not found, using embedded schema stub")
        return _EMBEDDED_SCHEMA
    return TYPES_PATH.read_text()


_EMBEDDED_SCHEMA = """\
// Fallback — keep in sync with src/types/index.ts
export type PeriodStructure = 'flat' | 'tou-2' | 'tou-3'
export type CustomerClass = 'residential' | 'commercial'
export interface ExportCredit { type: 'netting-retail'|'netting-reduced'|'netting-two-rate'|'buyback'|'none'; rate: number; excessRate?: number; note?: string }
export interface RateTier { upTo: number | null; rate: number }
export interface PeriodRates { supply: number; delivery: number | RateTier[] }
export interface PeriodDefinition { hours: [number, number]; weekendsOff: boolean }
export interface SeasonalRate { months: number[]; rates: Record<string, PeriodRates> }
export interface RatePlan {
  id: string; utility: string; operatingCompany: string; eiaId: string; state: string;
  name: string; rateCode: string; customerClass: CustomerClass; periodStructure: PeriodStructure;
  hasDemand: boolean; effectiveDate: string; periods: Record<string, PeriodDefinition>;
  rates: Record<string, PeriodRates>; seasonalRates?: SeasonalRate[]; fixedCharge: number;
  demandRate: number; demandRatchet?: { percent: number; lookbackMonths: number };
  exportCredit: ExportCredit; effectiveThrough?: string;
  supplySchedule?: { effectiveDate: string; rate: number }[];
  rateHistory?: { effectiveDate: string; rates: Record<string, PeriodRates> }[];
  deliveryComponents?: { name: string; rate: number }[];
  source: string; sourceUrl?: string; verifiedDate: string;
  confidence: 'high' | 'medium'; obtainedVia: string;
}
"""


# ── Step 1: Fetch PDF ─────────────────────────────────────────────────

def fetch_pdf(source: str) -> tuple[Path, str]:
    """
    If source is a URL, download to a temp file. If local path, use directly.
    Returns (local_path, display_source).
    """
    if source.startswith("http://") or source.startswith("https://"):
        print(f"  downloading {source}")
        req = urllib.request.Request(source, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
        except urllib.error.HTTPError as e:
            print(f"  error: HTTP {e.code} fetching {source}")
            sys.exit(1)
        except Exception as e:
            print(f"  error: {e}")
            sys.exit(1)

        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(data)
        tmp.close()
        print(f"  saved {len(data):,} bytes -> {tmp.name}")
        return Path(tmp.name), source
    else:
        p = Path(source).resolve()
        if not p.exists():
            print(f"  error: file not found: {p}")
            sys.exit(1)
        print(f"  using local file: {p}")
        return p, str(p)


# ── Step 2: Extract text from PDF ─────────────────────────────────────

def extract_text(pdf_path: Path) -> str | None:
    """Try pypdf first, fall back to pdfminer, return None if both fail."""
    # Try pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"--- PAGE {i + 1} ---\n{text}")
        if pages:
            result = "\n\n".join(pages)
            print(f"  extracted {len(result):,} chars from {len(pages)} pages (pypdf)")
            return result
    except ImportError:
        pass
    except Exception as e:
        print(f"  pypdf extraction failed: {e}")

    # Try pdfminer
    try:
        from pdfminer.high_level import extract_text as pm_extract
        result = pm_extract(str(pdf_path))
        if result and result.strip():
            print(f"  extracted {len(result):,} chars (pdfminer)")
            return result
    except ImportError:
        pass
    except Exception as e:
        print(f"  pdfminer extraction failed: {e}")

    print("  warning: no PDF text extractor available (install pypdf or pdfminer.six)")
    return None


# ── Step 3: LLM extraction ────────────────────────────────────────────

def build_extraction_prompt(schema_ts: str, rate_code_filter: str | None = None) -> str:
    """Build the system prompt for LLM extraction."""
    filter_clause = ""
    if rate_code_filter:
        filter_clause = f"\n- ONLY extract the rate plan with rate code '{rate_code_filter}'. Ignore all other plans."

    return f"""\
You are extracting utility rate plan data from an official tariff PDF filing.

Target schema (TypeScript):
```typescript
{schema_ts}
```

Instructions:
- Extract ALL rate plans found in this document.{filter_clause}
- For each plan, fill every field in the RatePlan interface.
- For each field, also provide evidence:
  - "source_quote": the exact text from the document this value came from
  - "confidence": "high" if the value is explicitly stated, "medium" if inferred from context, "low" if not found
  - "page": page number where the value was found (if available)
- Delivery components: list ALL per-kWh charges that sum to total delivery (distribution, transmission, system benefits, etc.)
- DO NOT invent or estimate numbers. If a value is not in the document, set it to null and mark confidence as "low".
- Supply rate: look for "Energy Charge", "Basic Service", "Energy Service", "Generation" -- these are the supply component.
- Customer charge: look for "Customer Charge", "Service Charge", "Meter Charge" per month.
- Demand charge: look for "Demand Charge" per kW or per kVA.
- TOU periods: look for "On-peak", "Off-peak", "Mid-peak" hour definitions.
- Effective date: look for "Effective:" or "Rates Effective:" dates.
- All per-kWh rates should be in $/kWh (e.g., 0.12345, NOT 12.345 cents).
- fixedCharge is in $/month.
- demandRate is in $/kW (0 if no demand charge).
- id format: lowercase utility abbreviation + hyphen + rate code (e.g., "evnh-r", "unh-d").
- periodStructure: "flat" if no time-of-use, "tou-2" if peak/off-peak, "tou-3" if peak/mid/off.
- For flat plans, use period key "flat" with hours [0, 24] and weekendsOff false.
- exportCredit: if net metering details are not in the document, use type "none" with rate 0.
- obtainedVia will be set by the tool, leave it as a placeholder.

Return a JSON array where each element has this shape:
```json
{{
  "plan": {{ "...all RatePlan fields..." }},
  "evidence": {{
    "fieldName": {{ "value": "...", "source_quote": "...", "confidence": "high|medium|low", "page": 1 }}
  }}
}}
```

Return ONLY valid JSON. No markdown fences, no commentary before or after the JSON array."""


def call_claude(api_key: str, config: dict, system_prompt: str, pdf_text: str) -> str:
    """Call the Anthropic Messages API via raw HTTP."""
    payload = {
        "model": config["model"],
        "max_tokens": config["max_tokens"],
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": f"Here is the text extracted from the tariff PDF:\n\n{pdf_text}",
            }
        ],
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        config["api_base"],
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read().decode())

    # Extract text from the response
    for block in result.get("content", []):
        if block.get("type") == "text":
            return block["text"]

    raise ValueError(f"No text content in Claude response: {json.dumps(result)[:500]}")


def call_openai(api_key: str, config: dict, system_prompt: str, pdf_text: str) -> str:
    """Call the OpenAI Chat Completions API via raw HTTP."""
    payload = {
        "model": config["model"],
        "max_tokens": config["max_tokens"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Here is the text extracted from the tariff PDF:\n\n{pdf_text}",
            },
        ],
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        config["api_base"],
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read().decode())

    return result["choices"][0]["message"]["content"]


def llm_extract(
    pdf_text: str,
    model_name: str,
    rate_code_filter: str | None = None,
) -> list[dict]:
    """Send PDF text to the configured LLM and parse the JSON response."""
    if model_name not in MODEL_CONFIGS:
        print(f"  error: unknown model '{model_name}'. Available: {', '.join(MODEL_CONFIGS)}")
        sys.exit(1)

    config = MODEL_CONFIGS[model_name]
    api_key = os.environ.get(config["env_key"], "")
    if not api_key:
        print(f"  error: {config['env_key']} not set. Export it before running.")
        sys.exit(1)

    schema_ts = load_rateplan_schema()
    system_prompt = build_extraction_prompt(schema_ts, rate_code_filter)

    print(f"  calling {config['model']}...")

    if model_name == "claude":
        raw = call_claude(api_key, config, system_prompt, pdf_text)
    elif model_name == "openai":
        raw = call_openai(api_key, config, system_prompt, pdf_text)
    else:
        raise ValueError(f"No API caller for model: {model_name}")

    # Strip markdown fences if the model wrapped them
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        cleaned = re.sub(r"^```\w*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Try to find JSON array in the response
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                print(f"  error: could not parse LLM response as JSON: {e}")
                print(f"  raw response (first 2000 chars):\n{raw[:2000]}")
                sys.exit(1)
        else:
            print(f"  error: could not parse LLM response as JSON: {e}")
            print(f"  raw response (first 2000 chars):\n{raw[:2000]}")
            sys.exit(1)

    if not isinstance(parsed, list):
        parsed = [parsed]

    print(f"  extracted {len(parsed)} plan(s) from LLM response")
    return parsed


# ── Step 4: Validation ─────────────────────────────────────────────────

def validate_plan(plan: dict) -> list[dict]:
    """
    Deterministic validation of an extracted plan.
    Returns a list of validation results, each with field, status, message.
    """
    results = []

    # Required fields
    required = [
        "id", "utility", "state", "rateCode", "customerClass",
        "periodStructure", "rates", "fixedCharge",
    ]
    for field in required:
        val = plan.get(field)
        if val is None or val == "" or val == {}:
            results.append({"field": field, "status": "fail", "message": "Required field missing"})
        else:
            results.append({"field": field, "status": "pass", "message": "Present"})

    # Supplementary fields (warn if missing, don't fail)
    optional_important = [
        "name", "operatingCompany", "eiaId", "effectiveDate",
        "periods", "hasDemand", "demandRate", "exportCredit",
        "source", "verifiedDate",
    ]
    for field in optional_important:
        val = plan.get(field)
        if val is None or val == "":
            results.append({"field": field, "status": "warn", "message": "Recommended field missing"})

    # Delivery components sum check
    if plan.get("deliveryComponents"):
        component_sum = sum(c.get("rate", 0) for c in plan["deliveryComponents"])
        # Get the delivery rate from the first period
        first_period = next(iter(plan.get("rates", {}).values()), {})
        delivery = first_period.get("delivery", 0)
        if isinstance(delivery, list):
            delivery = delivery[0].get("rate", 0) if delivery else 0
        diff = abs(component_sum - delivery)
        if diff < 0.0005:
            results.append({
                "field": "deliveryComponents",
                "status": "pass",
                "message": f"Sum {component_sum:.4f} matches delivery {delivery:.4f}",
            })
        else:
            results.append({
                "field": "deliveryComponents",
                "status": "warn",
                "message": f"Sum {component_sum:.4f} != delivery {delivery:.4f} (diff {diff:.4f})",
            })

    # Rate sanity checks
    for period_key, rates in plan.get("rates", {}).items():
        if not isinstance(rates, dict):
            results.append({
                "field": f"rates.{period_key}",
                "status": "fail",
                "message": f"Period rates is not an object: {type(rates).__name__}",
            })
            continue

        supply = rates.get("supply", 0)
        delivery = rates.get("delivery", 0)
        if isinstance(delivery, list):
            delivery = delivery[0].get("rate", 0) if delivery else 0

        if supply is not None and supply < 0:
            results.append({
                "field": f"rates.{period_key}.supply",
                "status": "fail",
                "message": f"Negative supply rate: {supply}",
            })
        if supply is not None and supply > 1.0:
            results.append({
                "field": f"rates.{period_key}.supply",
                "status": "warn",
                "message": f"Supply rate > $1/kWh: {supply} — was this extracted in cents?",
            })
        if isinstance(delivery, (int, float)) and delivery < -0.1:
            results.append({
                "field": f"rates.{period_key}.delivery",
                "status": "warn",
                "message": f"Large negative delivery: {delivery}",
            })
        if isinstance(delivery, (int, float)) and delivery > 1.0:
            results.append({
                "field": f"rates.{period_key}.delivery",
                "status": "warn",
                "message": f"Delivery rate > $1/kWh: {delivery} — was this extracted in cents?",
            })

    # Fixed charge check
    fixed = plan.get("fixedCharge")
    if fixed is not None and isinstance(fixed, (int, float)):
        if fixed < 0:
            results.append({"field": "fixedCharge", "status": "warn", "message": f"Negative customer charge: ${fixed}"})
        elif fixed > 1000:
            results.append({"field": "fixedCharge", "status": "warn", "message": f"Unusually high customer charge: ${fixed}"})

    # Period hours check
    for period_key, pdef in plan.get("periods", {}).items():
        if not isinstance(pdef, dict):
            continue
        hours = pdef.get("hours", [])
        if isinstance(hours, list) and len(hours) == 2:
            if not (0 <= hours[0] <= 24 and 0 <= hours[1] <= 24):
                results.append({
                    "field": f"periods.{period_key}.hours",
                    "status": "fail",
                    "message": f"Hours out of range: {hours}",
                })

    # Effective date format check
    eff = plan.get("effectiveDate", "")
    if eff:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(eff)):
            results.append({
                "field": "effectiveDate",
                "status": "fail",
                "message": f"Invalid date format: {eff} (expected YYYY-MM-DD)",
            })
        else:
            # Check it parses as a real date
            try:
                datetime.strptime(str(eff), "%Y-%m-%d")
            except ValueError:
                results.append({
                    "field": "effectiveDate",
                    "status": "fail",
                    "message": f"Invalid date: {eff}",
                })

    # Period structure consistency
    ps = plan.get("periodStructure")
    rate_keys = set(plan.get("rates", {}).keys())
    if ps == "flat" and rate_keys and rate_keys != {"flat"}:
        results.append({
            "field": "periodStructure",
            "status": "warn",
            "message": f"periodStructure is 'flat' but rate keys are {rate_keys}",
        })
    elif ps == "tou-2" and len(rate_keys) != 2:
        results.append({
            "field": "periodStructure",
            "status": "warn",
            "message": f"periodStructure is 'tou-2' but found {len(rate_keys)} period(s): {rate_keys}",
        })
    elif ps == "tou-3" and len(rate_keys) != 3:
        results.append({
            "field": "periodStructure",
            "status": "warn",
            "message": f"periodStructure is 'tou-3' but found {len(rate_keys)} period(s): {rate_keys}",
        })

    # Customer class check
    cc = plan.get("customerClass")
    if cc and cc not in ("residential", "commercial"):
        results.append({
            "field": "customerClass",
            "status": "fail",
            "message": f"Invalid customerClass: {cc}",
        })

    # Demand rate consistency
    has_demand = plan.get("hasDemand")
    demand_rate = plan.get("demandRate", 0)
    if has_demand and (demand_rate is None or demand_rate == 0):
        results.append({
            "field": "demandRate",
            "status": "warn",
            "message": "hasDemand is true but demandRate is 0 or missing",
        })
    if not has_demand and demand_rate and demand_rate > 0:
        results.append({
            "field": "hasDemand",
            "status": "warn",
            "message": f"hasDemand is false but demandRate is {demand_rate}",
        })

    return results


def summarize_validation(all_results: list[list[dict]]) -> dict:
    """Aggregate validation results across all plans."""
    total_pass = 0
    total_warn = 0
    total_fail = 0
    for results in all_results:
        for r in results:
            if r["status"] == "pass":
                total_pass += 1
            elif r["status"] == "warn":
                total_warn += 1
            elif r["status"] == "fail":
                total_fail += 1
    return {"pass": total_pass, "warn": total_warn, "fail": total_fail}


# ── Step 5: Output ─────────────────────────────────────────────────────

def stamp_obtained_via(plan: dict, model_name: str, source_display: str) -> dict:
    """Set the obtainedVia field with extraction metadata."""
    model_id = MODEL_CONFIGS.get(model_name, {}).get("model", model_name)
    plan["obtainedVia"] = f"llm-extract \u00b7 {model_id} \u00b7 {source_display} \u00b7 human-verified: false"
    plan["confidence"] = "medium"
    if not plan.get("verifiedDate"):
        plan["verifiedDate"] = date.today().isoformat()
    return plan


def write_outputs(
    extractions: list[dict],
    output_dir: Path,
    source_display: str,
    model_name: str,
    generate_review: bool,
) -> list[Path]:
    """Write plan JSON files (and optionally HTML review report) to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    all_validation = []

    for extraction in extractions:
        plan = extraction.get("plan", extraction)
        evidence = extraction.get("evidence", {})

        # Stamp metadata
        plan = stamp_obtained_via(plan, model_name, source_display)

        # Validate
        validation = validate_plan(plan)
        all_validation.append(validation)

        # Determine filename
        plan_id = plan.get("id", "unknown")
        filename = f"{plan_id}.json"
        filepath = output_dir / filename

        # Write the clean plan JSON (no evidence — that goes in the report)
        with open(filepath, "w") as f:
            json.dump(plan, f, indent=2)
            f.write("\n")
        written.append(filepath)
        print(f"  wrote {filepath}")

        # Print validation summary for this plan
        fails = [r for r in validation if r["status"] == "fail"]
        warns = [r for r in validation if r["status"] == "warn"]
        passes = [r for r in validation if r["status"] == "pass"]
        print(f"    validation: {len(passes)} pass, {len(warns)} warn, {len(fails)} fail")
        for r in fails:
            print(f"      FAIL  {r['field']}: {r['message']}")
        for r in warns:
            print(f"      WARN  {r['field']}: {r['message']}")

    # Generate HTML review report
    if generate_review:
        # Ensure cli/ is importable regardless of cwd
        import importlib.util
        spec = importlib.util.spec_from_file_location("report", CLI_DIR / "report.py")
        report_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(report_mod)
        generate_review_report = report_mod.generate_review_report

        report_path = output_dir / "review.html"
        generate_review_report(
            extractions=extractions,
            validation_results=all_validation,
            source_display=source_display,
            model_name=model_name,
            output_path=report_path,
        )
        print(f"  wrote review report: {report_path}")
        written.append(report_path)

    summary = summarize_validation(all_validation)
    print(
        f"\n  Summary: {len(extractions)} plan(s), "
        f"{summary['pass']} pass, {summary['warn']} warn, {summary['fail']} fail"
    )

    return written


# ── CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Extract rate plan data from a tariff PDF using an LLM.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  python cli/extract.py https://unitil.com/.../NH-Residential-Electric-Rates.pdf
  python cli/extract.py ./local-tariff.pdf --output drafts/ --review
  python cli/extract.py tariff.pdf --rate-code R-1
  python cli/extract.py --list-models
""",
    )
    parser.add_argument(
        "source",
        nargs="?",
        help="URL or local path to the tariff PDF",
    )
    parser.add_argument(
        "--output", "-o",
        default="drafts",
        help="Output directory for draft JSON files (default: drafts/)",
    )
    parser.add_argument(
        "--review",
        action="store_true",
        help="Generate an HTML review report alongside JSON files",
    )
    parser.add_argument(
        "--rate-code",
        help="Extract only the plan with this rate code",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("RATEMAP_MODEL", "claude"),
        help="LLM model to use (default: RATEMAP_MODEL env var or 'claude')",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="List available model configurations and exit",
    )

    args = parser.parse_args()

    # ── List models ──
    if args.list_models:
        print("Available models:")
        for name, cfg in MODEL_CONFIGS.items():
            key_set = "SET" if os.environ.get(cfg["env_key"]) else "NOT SET"
            print(f"  {name:10s}  model={cfg['model']:30s}  key={cfg['env_key']} ({key_set})")
        return

    # ── Require source ──
    if not args.source:
        parser.print_help()
        sys.exit(1)

    print(f"RateMap Extract")
    print(f"  model: {args.model} ({MODEL_CONFIGS.get(args.model, {}).get('model', '?')})")
    print()

    # Step 1: Fetch
    print("Step 1: Fetch PDF")
    pdf_path, source_display = fetch_pdf(args.source)

    # Step 2: Extract text
    print("\nStep 2: Extract text")
    pdf_text = extract_text(pdf_path)
    if not pdf_text:
        print("  no text extracted — cannot proceed without a PDF text extractor")
        print("  install pypdf:  pip install pypdf>=4.0")
        sys.exit(1)

    # Step 3: LLM extraction
    print("\nStep 3: LLM extraction")
    extractions = llm_extract(pdf_text, args.model, args.rate_code)

    # Step 4 & 5: Validate and output
    print("\nStep 4: Validate & output")
    output_dir = Path(args.output).resolve()
    write_outputs(
        extractions=extractions,
        output_dir=output_dir,
        source_display=source_display,
        model_name=args.model,
        generate_review=args.review,
    )

    print("\nDone.")


if __name__ == "__main__":
    main()
