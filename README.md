# Unslant

A Chrome extension that analyses news articles for bias, credibility, and missing context. Open the side panel on any article, click **Analyse Page**, and get an instant breakdown.

## What it shows

- Plain-language summary of the article
- Central claim and cross-source corroboration
- Evidence provided and what context is missing
- Source reliability: political bias, factual reporting, and credibility rating (via Media Bias/Fact Check)
- Content flags: emotional language, framing issues, and cited source quality

## Stack

| Layer        | Tech                                                  |
|--------------|-------------------------------------------------------|
| Extension    | Chrome Manifest V3 · React 18 · Vite · Tailwind CSS  |
| Backend      | Python · FastAPI · Anthropic Claude · trafilatura     |
| Outlet data  | Media Bias/Fact Check via RapidAPI                    |
| Corroboration| NewsAPI                                               |

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
NEWS_API_KEY=your_newsapi_key_here
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Build the extension

```bash
cd extension
npm install
npx vite build
```

### 4. Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder

Navigate to any news article and click the Unslant icon in the toolbar to open the side panel.

---

## Deployment

- **Backend** is deployed on [Railway](https://railway.app)
- **Extension** is published on the [Chrome Web Store](https://chrome.google.com/webstore)

Set the `ALLOWED_ORIGINS` env var on Railway to include your extension's `chrome-extension://<id>` origin.

---

## Project structure

```
unslant/
├── backend/
│   ├── main.py              # FastAPI app — all endpoints and logic
│   ├── requirements.txt
│   ├── .env.example
│   ├── railway.toml
│   └── Procfile
├── extension/
│   ├── manifest.json        # Chrome Manifest V3
│   ├── background.js        # Service worker — opens side panel
│   ├── content.js           # Content script — extracts article text
│   ├── src/
│   │   ├── SidePanelApp.jsx # Main UI component
│   │   ├── components/
│   │   │   ├── ExplanationPanel.jsx
│   │   │   └── ReliabilityPanel.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── icons/
│   ├── package.json
│   └── vite.config.js
├── PRIVACY_POLICY.md
└── README.md
```
