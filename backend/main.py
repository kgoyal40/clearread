import asyncio
import json
import os
from urllib.parse import urlparse
from fastapi.responses import StreamingResponse

import anthropic
import httpx
import trafilatura
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="ClearRead API")

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")


class AnalyzeRequest(BaseModel):
    url: str


def extract_domain(url: str) -> str:
    parsed = urlparse(url)
    domain = parsed.netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def fetch_article_sync(url: str) -> tuple:
    """Fetches and extracts article text + title. Runs synchronously (for thread pool)."""
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not fetch the article. It may be behind a paywall, "
                "require login, or block automated access."
            ),
        )

    metadata = trafilatura.extract_metadata(downloaded)
    title = metadata.title if metadata else None

    text = trafilatura.extract(downloaded, favor_recall=True)

    if not text or len(text) < 100:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not extract readable content from this page. "
                "It may be behind a paywall or is not a standard article."
            ),
        )

    return text, title


_mbfc_cache: list | None = None


async def get_all_mbfc_sources() -> list:
    global _mbfc_cache
    if _mbfc_cache is not None:
        return _mbfc_cache

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://media-bias-fact-check-ratings-api2.p.rapidapi.com/fetch-data",
            headers={
                "X-RapidAPI-Key": RAPIDAPI_KEY,
                "X-RapidAPI-Host": "media-bias-fact-check-ratings-api2.p.rapidapi.com",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        _mbfc_cache = data if isinstance(data, list) else data.get("data", [])
        return _mbfc_cache


async def get_outlet_info(domain: str) -> dict:
    if not RAPIDAPI_KEY:
        return {"found": False, "reason": "no_api_key"}

    try:
        sources = await get_all_mbfc_sources()

        # Match on Source URL field (strip www. from both sides)
        clean_domain = domain.removeprefix("www.")
        outlet = next(
            (s for s in sources if (s.get("Source URL") or "").strip().lower() == clean_domain.lower()),
            None,
        )

        if outlet is None:
            return {"found": False, "reason": "not_in_database", "domain": domain}

        return {
            "found": True,
            "name": outlet.get("Source", domain),
            "bias_rating": outlet.get("Bias", "Unknown"),
            "factual_reporting": outlet.get("Factual Reporting", "Unknown"),
            "credibility_rating": outlet.get("Credibility", "Unknown"),
            "country": outlet.get("Country", ""),
            "media_type": outlet.get("Media Type", ""),
            "source_url": outlet.get("Source URL", ""),
        }

    except httpx.HTTPStatusError as e:
        return {"found": False, "reason": "api_error", "detail": str(e)}
    except Exception as e:
        return {"found": False, "reason": "error", "detail": str(e)}


async def assess_outlet_with_claude(domain: str) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""What do you know about the news outlet at "{domain}"? Return ONLY a JSON object — no markdown, no code fences, no commentary.

If you have no reliable knowledge of this outlet, return exactly: {{"known": false}}

Otherwise return:
{{
  "known": true,
  "name": "Full outlet name",
  "bias_rating": "One of: Extreme Left, Left, Left-Center, Center, Right-Center, Right, Extreme Right, Conspiracy / Pseudoscience, Pro-Science, Satire, Unknown",
  "factual_reporting": "One of: VERY HIGH, HIGH, MOSTLY FACTUAL, MIXED, LOW, VERY LOW, Unknown",
  "credibility_rating": "One of: High, Medium, Low, Unknown",
  "country": "Country name or empty string",
  "media_type": "e.g. Newspaper, Online, TV, Radio, or empty string",
  "summary": "1-2 sentences on what this outlet is known for and any notable reliability concerns"
}}"""

    loop = asyncio.get_event_loop()
    message = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        ),
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        response_text = "\n".join(lines[1:end])

    data = json.loads(response_text)

    if not data.get("known"):
        return {"found": False, "reason": "not_in_database", "domain": domain}

    return {
        "found": True,
        "source": "claude",
        "name": data.get("name", domain),
        "bias_rating": data.get("bias_rating", "Unknown"),
        "factual_reporting": data.get("factual_reporting", "Unknown"),
        "credibility_rating": data.get("credibility_rating", "Unknown"),
        "country": data.get("country", ""),
        "media_type": data.get("media_type", ""),
        "source_url": domain,
        "summary": data.get("summary", ""),
    }


def _parse_claude_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[1:end])
    return json.loads(text)


def _claude_call(client, prompt: str, max_tokens: int) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def analyze_with_claude(article_text: str, title: str | None) -> dict:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured.")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    title_line = f'Article title: "{title}"\n\n' if title else ""

    prompt = f"""{title_line}Analyze the following news article and return ONLY a JSON object — no markdown, no code fences, no commentary.

Article text:
{article_text[:8000]}

Return exactly this JSON structure:
{{
  "plain_summary": "2–3 sentences explaining what this article is about in plain language for a general audience",
  "article_analysis": {{
    "central_claim": "One sentence stating the main claim or thesis of the article",
    "evidence_provided": ["Each piece of evidence, data point, quote, or named source as a separate string. Empty array if none."],
    "content_type": "exactly one of: news, opinion, analysis, satire, press_release, unknown",
    "what_is_missing": ["Each missing context, counterargument, or absent piece of information as a separate string. Empty array if none."]
  }},
  "reliability_flags": {{
    "cites_sources": true or false,
    "emotionally_loaded_language": true or false,
    "style": "exactly one of: news, opinion, mixed",
    "cites_sources_explanation": "One sentence explaining whether/how sources are cited",
    "emotionally_loaded_explanation": "One sentence explaining if emotional language is present, or empty string if false",
    "framing_issues": [
      {{
        "phrase": "exact phrase or pattern from the article that reveals bias",
        "explanation": "one sentence explaining why this shows biased framing",
        "direction": "who this framing favors or disadvantages"
      }}
    ]
  }},
  "cited_sources": ["Named news outlets, publications, or known organizations cited. For social media citations include the specific account e.g. '@WHO on Twitter'. Exclude unnamed sources, 'officials', 'experts'. Empty array if none."]
}}"""

    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, lambda: _claude_call(client, prompt, 2000))
    return _parse_claude_json(text)


async def assess_outlet_with_claude(domain: str) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"""What do you know about the news outlet at "{domain}"? Return ONLY a JSON object — no markdown, no code fences, no commentary.

If you have no reliable knowledge of this outlet, return exactly: {{"known": false}}

Otherwise return:
{{
  "known": true,
  "name": "Full outlet name",
  "bias_rating": "One of: Extreme Left, Left, Left-Center, Center, Right-Center, Right, Extreme Right, Conspiracy / Pseudoscience, Pro-Science, Satire, Unknown",
  "factual_reporting": "One of: VERY HIGH, HIGH, MOSTLY FACTUAL, MIXED, LOW, VERY LOW, Unknown",
  "credibility_rating": "One of: High, Medium, Low, Unknown",
  "country": "Country name or empty string",
  "media_type": "e.g. Newspaper, Online, TV, Radio, or empty string",
  "summary": "1-2 sentences on what this outlet is known for and any notable reliability concerns"
}}"""

    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, lambda: _claude_call(client, prompt, 400))
    data = _parse_claude_json(text)

    if not data.get("known"):
        return {"found": False, "reason": "not_in_database", "domain": domain}

    return {
        "found": True,
        "source": "claude",
        "name": data.get("name", domain),
        "bias_rating": data.get("bias_rating", "Unknown"),
        "factual_reporting": data.get("factual_reporting", "Unknown"),
        "credibility_rating": data.get("credibility_rating", "Unknown"),
        "country": data.get("country", ""),
        "media_type": data.get("media_type", ""),
        "source_url": domain,
        "summary": data.get("summary", ""),
    }


async def score_cited_sources(sources: list) -> dict:
    if not sources:
        return {"score": None, "level": None, "sources_assessed": []}

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    sources_list = "\n".join(f"- {s}" for s in sources)

    prompt = f"""For each source below rate their reliability 0.0-1.0. Return ONLY a JSON array — no markdown, no code fences.

Sources:
{sources_list}

Return exactly:
[
  {{"name": "source name", "score": 0.0 to 1.0, "known": true or false, "type": "outlet, social_media, organization, study, or other"}}
]

Scoring: 0.9-1.0=highly reliable (Reuters/AP), 0.7-0.89=generally reliable, 0.5-0.69=mixed, 0.3-0.49=low, 0.0-0.29=very low.
For social media: score the specific account/person, NOT the platform."""

    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, lambda: _claude_call(client, prompt, 600))
    assessed = _parse_claude_json(text)
    known = [s for s in assessed if s.get("known")]

    if not known:
        return {"score": None, "level": None, "sources_assessed": assessed}

    composite = sum(s["score"] for s in known) / len(known)
    return {
        "score": round(composite, 2),
        "level": _score_to_level(composite),
        "sources_assessed": assessed,
    }


def _score_to_level(score: float) -> str:
    if score >= 0.8:
        return "Very High"
    if score >= 0.6:
        return "High"
    if score >= 0.4:
        return "Medium"
    if score >= 0.2:
        return "Low"
    return "Very Low"


async def score_cited_sources(sources: list) -> dict:
    if not sources:
        return {"score": None, "level": None, "sources_assessed": []}

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    sources_list = "\n".join(f"- {s}" for s in sources)
    prompt = f"""For each of the following news outlets or organizations, rate their general reliability and factual accuracy as a score between 0.0 and 1.0.
Only score sources you have reliable knowledge of. Return ONLY a JSON array — no markdown, no code fences, no commentary.

Sources:
{sources_list}

Return exactly this structure:
[
  {{"name": "source name", "score": 0.0 to 1.0, "known": true or false}}
]

Scoring guide: 0.9-1.0 = highly reliable (e.g. Reuters, AP), 0.7-0.89 = generally reliable, 0.5-0.69 = mixed reliability, 0.3-0.49 = low reliability, 0.0-0.29 = very low / known misinformation."""

    loop = asyncio.get_event_loop()
    message = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        ),
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        response_text = "\n".join(lines[1:end])

    assessed = json.loads(response_text)
    known = [s for s in assessed if s.get("known")]

    if not known:
        return {"score": None, "level": None, "sources_assessed": assessed}

    composite = sum(s["score"] for s in known) / len(known)

    return {
        "score": round(composite, 2),
        "level": _score_to_level(composite),
        "sources_assessed": assessed,
    }


async def search_claim(claim: str) -> list[dict]:
    """Search NewsAPI for articles covering the same claim."""
    if not NEWS_API_KEY:
        return []

    # Truncate claim to a clean search query (first 100 chars, cut at word boundary)
    query = claim[:100].rsplit(" ", 1)[0] if len(claim) > 100 else claim

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "relevancy",
                    "pageSize": 10,
                    "apiKey": NEWS_API_KEY,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            return [
                {
                    "source": a["source"]["name"],
                    "title": a["title"],
                    "description": a.get("description", ""),
                    "url": a["url"],
                }
                for a in data.get("articles", [])
                if a.get("title") and a.get("source", {}).get("name")
            ]
    except Exception:
        return []


async def assess_corroboration(claim: str, original_domain: str, articles: list[dict]) -> dict:
    """Ask Claude to assess whether search results corroborate or contradict the claim."""
    if not articles:
        return {
            "level": "Single Source",
            "summary": "No other sources found reporting on this claim.",
            "supporting": [],
            "contradicting": [],
        }

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    articles_text = "\n".join(
        f"- [{a['source']}] {a['title']} — {a['description']}"
        for a in articles
        if a["source"].lower() not in original_domain.lower()
           and original_domain.lower() not in a["source"].lower()
    )

    if not articles_text:
        return {
            "level": "Single Source",
            "summary": "No independent sources found reporting on this claim.",
            "supporting": [],
            "contradicting": [],
        }

    prompt = f"""You are assessing how well a claim is corroborated across independent news sources.

Claim: "{claim}"

Other news sources found:
{articles_text}

Assess whether these sources support, contradict, or are unrelated to the claim.
Return ONLY a JSON object — no markdown, no code fences.

{{
  "level": "exactly one of: Strong, Moderate, Weak, Single Source, Contradicted",
  "summary": "One sentence explaining the corroboration status",
  "supporting": ["list of outlet names that clearly support or confirm the claim"],
  "contradicting": ["list of outlet names that clearly contradict the claim"]
}}

Level guide:
- Strong: 3+ independent reliable sources confirm the claim
- Moderate: 1-2 independent sources confirm, or many less reliable ones
- Weak: sources are tangentially related but don't directly confirm
- Single Source: no independent sources found covering this claim
- Contradicted: one or more sources directly contradict the claim"""

    loop = asyncio.get_event_loop()
    message = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        ),
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        response_text = "\n".join(lines[1:end])

    return json.loads(response_text)


def sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    url = request.url.strip()

    if not url.startswith(("http://", "https://")):
        return StreamingResponse(
            iter([sse("error", {"detail": "URL must start with http:// or https://"})]),
            media_type="text/event-stream",
        )

    async def generate():
        try:
            loop = asyncio.get_event_loop()

            # Step 1: fetch article
            try:
                article_text, title = await loop.run_in_executor(None, fetch_article_sync, url)
            except HTTPException as e:
                yield sse("error", {"detail": e.detail})
                return

            domain = extract_domain(url)
            yield sse("title", {"title": title, "url": url, "domain": domain})

            # Step 2: MBFC + Claude analysis in parallel — yield whichever finishes first
            mbfc_task = asyncio.create_task(get_outlet_info(domain))
            claude_task = asyncio.create_task(analyze_with_claude(article_text, title))

            pending = {mbfc_task, claude_task}
            mbfc_info = None
            claude_analysis = None

            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task is mbfc_task:
                        mbfc_info = task.result()
                    elif task is claude_task:
                        claude_analysis = task.result()

                # Yield outlet as soon as we have both MBFC result and know if we need fallback
                if mbfc_info is not None and claude_analysis is None:
                    # MBFC finished first — yield preliminary outlet, wait for Claude
                    if mbfc_info.get("found"):
                        yield sse("outlet", mbfc_info)

                if claude_analysis is not None and mbfc_info is not None:
                    # Both done — resolve outlet and yield analysis
                    if not mbfc_info.get("found") and mbfc_info.get("reason") != "no_api_key":
                        outlet_info = await assess_outlet_with_claude(domain)
                    else:
                        outlet_info = mbfc_info

                    yield sse("outlet", outlet_info)
                    yield sse("analysis", claude_analysis)

            cited_sources = claude_analysis.pop("cited_sources", [])
            central_claim = claude_analysis.get("article_analysis", {}).get("central_claim", "")
            content_type = claude_analysis.get("article_analysis", {}).get("content_type", "")

            # Step 3: source scoring + news search in parallel
            source_task = asyncio.create_task(score_cited_sources(cited_sources))
            search_task = asyncio.create_task(
                search_claim(central_claim)
                if content_type not in ("opinion", "satire")
                else asyncio.sleep(0, result=[])
            )

            pending = {source_task, search_task}
            search_results = []

            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task is source_task:
                        yield sse("source_reliability", task.result())
                    elif task is search_task:
                        search_results = task.result()

            # Step 4: corroboration
            if content_type not in ("opinion", "satire") and search_results:
                corroboration = await assess_corroboration(central_claim, domain, search_results)
                yield sse("corroboration", corroboration)

            yield sse("done", {})

        except Exception as e:
            yield sse("error", {"detail": str(e)})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/health")
def health():
    return {"status": "ok"}
