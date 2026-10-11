# ratemap extract

CLI tool that extracts rate plan data from tariff PDFs using an LLM, validates
every field deterministically, and produces draft JSON files with an optional
HTML review report.

## Setup

```bash
pip install pypdf          # PDF text extraction
# One of the following API keys:
export ANTHROPIC_API_KEY=sk-...   # for Claude (default)
export OPENAI_API_KEY=sk-...      # for OpenAI
```

All dependencies in `requirements.txt` are optional except the one matching
your configured model. The tool uses raw HTTP calls (urllib) for LLM APIs, so
no SDK is required. `pypdf` is needed for PDF text extraction.

## Usage

```bash
# Extract from a URL
python cli/extract.py https://unitil.com/.../NH-Residential-Electric-Rates.pdf

# Extract from a local file with HTML review report
python cli/extract.py ./local-tariff.pdf --output drafts/ --review

# Extract a single rate code
python cli/extract.py tariff.pdf --rate-code R-1

# Use OpenAI instead of Claude
RATEMAP_MODEL=openai python cli/extract.py tariff.pdf

# List available models
python cli/extract.py --list-models
```

## Output

Draft JSON files are written to `drafts/` (or `--output` path). Each file
matches the RatePlan schema from `src/types/index.ts` with
`human-verified: false` in the `obtainedVia` field.

The `--review` flag generates `review.html` showing every field with its
source quote, confidence level, and validation status.

## Review workflow

1. Run the extraction
2. Open `drafts/review.html` and check each field against the original PDF
3. Fix any FAIL/WARN items in the draft JSON
4. Copy approved files to `src/data/plans/`
5. Update `obtainedVia` to `human-verified: true`
