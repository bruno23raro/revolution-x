# Protocol P0.8 — Section 6: Catálogo

## 6.1 python scripts/api_index.py

Generate the API index using the project's Python script. This script scans all available endpoints and creates a catalog.

**Expected output**:
- List of all API endpoints
- Documentation for each endpoint
- Authentication requirements
- Example request/response pairs

**Execution**:
```bash
python scripts/api_index.py
```

## 6.2 Verification

Validate the generated index:
```python
import sqlite3
result = sqlite3.connect('vendor/api_index.sqlite').execute('SELECT count(*) from api').fetchone()
print(f"Total API endpoints cataloged: {result[0]}")
```

**Expected**: Count of all API endpoints that were cataloged. The candidate endpoints should only include those with:
- HTTPS=Yes
- auth=None or apiKey
- curl 200/401 responses
- JSON format responses

**Filter criteria**:
- `HTTPS=Yes` — only secure endpoints
- `auth None/apiKey` — no auth or API key based
- `curl 200/401` — expected HTTP responses (not 500, not 3xx redirect loops)
- `JSON` — response format is JSON

## 6.3 Candidate Selection

From the cataloged APIs, select candidates that meet all four criteria. These form the documented API surface for the Revolution X platform.

**Output format**: List each candidate endpoint with its:
- Path/URL
- HTTP methods
- Authentication type
- Expected responses
- Description