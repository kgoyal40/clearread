# ClearRead

Paste a news article URL and get a plain-language explanation alongside a reliability assessment of the source outlet.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | Python · FastAPI · trafilatura · Anthropic Claude |
| Outlet data | Media Bias/Fact Check via RapidAPI |
| Frontend | React 18 · Vite · Tailwind CSS |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [RapidAPI key](https://rapidapi.com/) subscribed to the [Media Bias/Fact Check API](https://rapidapi.com/media-bias-fact-check-media-bias-fact-check-default/api/media-bias-fact-check)

> **Note:** The app works without a RapidAPI key — the outlet reliability panel will display a "not configured" message, while the article analysis continues to work normally.

---

## Setup

### 1. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
RAPIDAPI_KEY=your_rapidapi_key_here
```

### 2. Start the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**. Visit `/docs` for the interactive Swagger UI.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at **http://localhost:5173**

---

## API Reference

### `POST /analyze`

**Request body:**
```json
{ "url": "https://example.com/some-article" }
```

**Successful response:**
```json
{
  "url": "https://example.com/some-article",
  "domain": "example.com",
  "title": "Article headline (if extractable)",
  "plain_summary": "2–3 sentence plain-language summary.",
  "article_analysis": {
    "central_claim": "One sentence stating the main thesis.",
    "evidence_provided": "Description of evidence, data, or sources cited.",
    "content_type": "news | opinion | analysis | satire | press_release | unknown",
    "what_is_missing": "Context or counterarguments absent from the article."
  },
  "reliability_flags": {
    "cites_sources": true,
    "emotionally_loaded_language": false,
    "style": "news | opinion | mixed",
    "cites_sources_explanation": "Explanation of sourcing behaviour.",
    "emotionally_loaded_explanation": "Explanation if emotional language found, else empty string."
  },
  "outlet": {
    "found": true,
    "name": "Example News",
    "bias_rating": "Center",
    "factual_reporting": "HIGH",
    "credibility_rating": "HIGH CREDIBILITY",
    "country": "United States",
    "media_type": "Online",
    "source_url": "example.com"
  }
}
```

**Error responses:**

| Status | Cause |
|--------|-------|
| `400` | URL does not start with `http://` or `https://` |
| `422` | Article is behind a paywall, requires login, or the page has no readable content |
| `500` | Missing `ANTHROPIC_API_KEY` or unexpected server error |

---

## How it works

1. **Article extraction** — [trafilatura](https://trafilatura.readthedocs.io/) fetches the page and strips boilerplate, leaving only article body text.
2. **Outlet lookup** — the root domain is queried against the MBFC RapidAPI to retrieve bias rating, factual reporting score, and credibility rating.
3. **Claude analysis** — the article text (truncated to 8 000 characters) is sent to `claude-sonnet-4-6` which returns a structured JSON response containing the summary, central claim, evidence assessment, content-type classification, and reliability flags.
4. **Combined response** — all three results are merged and returned in a single JSON payload to the frontend.

---

## Project structure

```
clearread/
├── backend/
│   ├── main.py            # FastAPI app — all endpoints and logic
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                        # Root component, state management
│   │   ├── components/
│   │   │   ├── UrlInput.jsx               # URL input form
│   │   │   ├── ExplanationPanel.jsx       # Left panel: article breakdown
│   │   │   └── ReliabilityPanel.jsx       # Right panel: source reliability
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js     # Proxies /api/* → http://localhost:8000/*
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```
