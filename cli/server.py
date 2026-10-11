#!/usr/bin/env python3
"""Extraction API server for RateMap admin UI."""
import base64
import json
import os
import re
import sys
import tempfile
import traceback
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Add CLI dir to path so we can import extract
sys.path.insert(0, str(Path(__file__).parent))
from extract import fetch_pdf, extract_text, llm_extract, validate_plan, stamp_obtained_via, MODEL_CONFIGS


BILL_EXTRACTION_PROMPT = """\
You are extracting data from a residential/commercial electric utility bill.

Extract these fields:
- utility: the utility company name
- state: the state (2-letter code)
- rateCode: the rate schedule code if shown (e.g., "R-1", "Rate 1", "D")
- billingPeriod: start and end dates of the billing period (ISO format)
- usage: total kWh consumed. If TOU, also extract peak and off-peak kWh.
- charges: each line item on the bill with its dollar amount. Identify:
  - supply/generation/energy service charge ($ and implied $/kWh rate)
  - delivery/distribution charge ($ and implied $/kWh rate)
  - customer/service/meter charge ($ fixed monthly)
  - demand charge ($ and kW, if present)
  - any other named charges with their amounts
- totalBilled: the total amount due

For each field, assess confidence: "high" if clearly labeled on the bill, "medium" if inferred, "low" if not found.

DO NOT extract customer name, account number, or address — these are PII.

Return a JSON object with this shape:
{
  "utility": "string",
  "state": "XX",
  "rateCode": "string or null",
  "billingPeriod": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "usage": { "total": number, "peak": number_or_null, "offPeak": number_or_null },
  "charges": {
    "supply": { "amount": number, "rate": number_per_kwh, "kwh": number },
    "delivery": { "amount": number, "rate": number_per_kwh, "kwh": number },
    "customerCharge": number,
    "demandCharge": number_or_null,
    "demandKw": number_or_null,
    "otherCharges": [ { "name": "string", "amount": number } ],
    "totalBilled": number
  },
  "confidence": {
    "utility": "high|medium|low",
    "usage": "high|medium|low",
    "supply": "high|medium|low",
    "delivery": "high|medium|low",
    "total": "high|medium|low"
  }
}

Return JSON only. No markdown fences, no commentary."""


# ── Shared pipeline helpers ────────────────────────────────────


def fetch_and_extract_text(source, *, pdf_base64=None):
    """Resolve a PDF from a URL or base64 string and return extracted text.

    Returns (text, pdf_path) or raises on failure.
    """
    if pdf_base64:
        pdf_bytes = base64.b64decode(pdf_base64)
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(pdf_bytes)
        tmp.close()
        pdf_path = Path(tmp.name)
        print(f"  received {len(pdf_bytes):,} bytes via base64 upload")
    elif source:
        pdf_path, _ = fetch_pdf(source)
    else:
        raise ValueError("Provide either pdfBase64 or url")

    text = extract_text(pdf_path)
    if not text:
        raise ValueError("No text could be extracted from the PDF. Install pypdf: pip install pypdf>=4.0")
    return text, pdf_path


def call_llm(text, prompt, model_name):
    """Call the configured LLM with a system prompt and user text, return parsed JSON."""
    if model_name not in MODEL_CONFIGS:
        raise ValueError(f"Unknown model '{model_name}'")

    config = MODEL_CONFIGS[model_name]
    api_key = os.environ.get(config["env_key"], "")
    if not api_key:
        raise ValueError(f"{config['env_key']} not set")

    print(f"  calling {config['model']}...")

    if model_name == "claude":
        raw = _call_claude(api_key, config, prompt, text)
    elif model_name == "openai":
        raw = _call_openai(api_key, config, prompt, text)
    else:
        raise ValueError(f"No API caller for model: {model_name}")

    # Strip markdown fences
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```\w*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
        else:
            raise ValueError(f"Could not parse LLM response as JSON: {cleaned[:500]}")

    return parsed


def _call_claude(api_key, config, system_prompt, user_text):
    payload = {
        "model": config["model"],
        "max_tokens": config["max_tokens"],
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": f"Here is the text extracted from the utility bill:\n\n{user_text}"}
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
    for block in result.get("content", []):
        if block.get("type") == "text":
            return block["text"]
    raise ValueError("No text content in Claude response")


def _call_openai(api_key, config, system_prompt, user_text):
    payload = {
        "model": config["model"],
        "max_tokens": config["max_tokens"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is the text extracted from the utility bill:\n\n{user_text}"},
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


# ── HTTP Handler ───────────────────────────────────────────────


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._json_response({
                "status": "ok",
                "model": os.environ.get("RATEMAP_MODEL", "claude"),
            })
        else:
            self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))

        if self.path == "/extract":
            self._handle_extract(body)
        elif self.path == "/reconcile":
            self._handle_reconcile(body)
        else:
            self.send_error(404)

    def _handle_extract(self, body):
        url = body.get("url", "")
        rate_code = body.get("rateCode")
        model = os.environ.get("RATEMAP_MODEL", "claude")

        try:
            # Step 1: Fetch PDF
            pdf_path, source_display = fetch_pdf(url)

            # Step 2: Extract text
            text = extract_text(pdf_path)
            if not text:
                self._json_response(
                    {"error": "No text could be extracted from the PDF. Install pypdf: pip install pypdf>=4.0"},
                    status=422,
                )
                return

            # Step 3: LLM extraction
            extractions = llm_extract(text, model, rate_code)

            # Step 4: Validate each plan
            results = []
            for ext in extractions:
                plan = ext.get("plan", ext)
                evidence = ext.get("evidence", {})

                # Stamp metadata
                plan = stamp_obtained_via(plan, model, source_display)

                validation = validate_plan(plan)
                results.append({
                    "plan": plan,
                    "evidence": evidence,
                    "validation": validation,
                })

            self._json_response({
                "plans": results,
                "source": url,
                "textLength": len(text),
            })
        except SystemExit:
            self._json_response(
                {"error": "Extraction pipeline failed (see server logs)"},
                status=500,
            )
        except Exception as e:
            traceback.print_exc()
            self._json_response({"error": str(e)}, status=500)

    def _handle_reconcile(self, body):
        model = os.environ.get("RATEMAP_MODEL", "claude")

        try:
            text, _ = fetch_and_extract_text(
                body.get("url", ""),
                pdf_base64=body.get("pdfBase64"),
            )
            extracted = call_llm(text, BILL_EXTRACTION_PROMPT, model)
            print("  bill extraction complete")

            self._json_response({
                "extracted": extracted,
                "textLength": len(text),
            })
        except ValueError as e:
            status = 400 if "Provide either" in str(e) else 422 if "No text" in str(e) else 500
            self._json_response({"error": str(e)}, status=status)
        except SystemExit:
            self._json_response(
                {"error": "Bill extraction pipeline failed (see server logs)"},
                status=500,
            )
        except Exception as e:
            traceback.print_exc()
            self._json_response({"error": str(e)}, status=500)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, data, status=200):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        body = json.dumps(data).encode()
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"  [{self.command}] {self.path} -> {args[1] if len(args) > 1 else ''}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8787))
    server = HTTPServer(("localhost", port), Handler)
    print(f"RateMap extraction server on http://localhost:{port}")
    print(f"  model: {os.environ.get('RATEMAP_MODEL', 'claude')}")
    print(f"  API key: {'set' if os.environ.get('ANTHROPIC_API_KEY') else 'NOT SET'}")
    server.serve_forever()
