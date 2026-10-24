# CultureBridge ✳

**Different tastes. Unexpected chemistry.** A two-audience cultural mediation agent grounded in Qloo's taste graph. The website features a custom Three.js woven-ribbon sculpture where two taste signals converge, large readable typography, side-by-side taste profiles, human confirmation of Qloo identities, and evidence-led interactive results. The sculpture reacts to the discovery stage, with a reduced-motion and WebGL fallback.

**Built for the [Qloo Agentic Hackathon 2026](https://qloo.devpost.com/)**. CultureBridge helps community event coordinators, friendship groups, and campus club organizers choose film, music, or book experiences that neither audience has to sacrifice their tastes for.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Yashwanth034/CultureBridge-Qloo-Agent)

> **Deployment is not automatic.** This button opens a review flow in your own Render account. Enter your private Qloo event key as the `QLOO_API_KEY` environment variable there. Until the key is configured, the application intentionally shows an informative setup error rather than pretending to use Qloo.

## What makes it an agent

CultureBridge is a transparent five-step tool-using agent, not an ungrounded chat completion:

1. **Perceive:** ingest 1–3 cultural anchors for each of two audiences (film, music artist, book).
2. **Resolve:** retrieve Qloo entity UUIDs using live **GET /search**. An unresolved seed is omitted and reported; it is never fabricated.
3. **Scout independently:** use **GET /v2/insights** separately with A and B's tastes as signals, requesting up to 40 ranked candidates each.
4. **Explore jointly:** query **GET /v2/insights** with both groups' taste signals to discover potential cultural bridges that individual list intersections may miss.
5. **Evaluate/mediate:** compute evidence-backed two-sided overlaps, rerank by maximin fairness, or select a discovery-focused compromise that also rewards the joint Qloo result. If the initial independent result sets are full but disjoint, widen the Qloo search automatically. Distinguish verified agreement from exploratory joint-only suggestions. Show what each group would have selected alone, and provide an inspectable decision trail.

The app makes **no claim that relative-rank balance is an upstream affinity score, probability, or guarantee that participants will like an item**. It exposes each group's Qloo-derived ranking for transparency.

### Why Qloo matters

Without Qloo, there are no entity IDs or independent cross-domain taste rankings. Those separate Qloo responses drive every actual recommendation and every evidence bar. Removing Qloo causes a visible setup error, not an invented generic result. This lets judges see the difference between a hypothetical chat recommendation and Qloo-supported cultural grounding.

## Requirements

- Node.js 20 or later (zero third-party **server-side** npm dependencies; optional Three.js is served from a version-pinned CDN with a CSS fallback).
- A Qloo **hackathon event API key** from the [Qloo API key form](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key).
- The event key works **only** with `https://hackathon.api.qloo.com`. The backend supplies `X-Api-Key`. Never put the key into HTML, git or frontend configuration.

## Run locally

```bash
export QLOO_API_KEY="YOUR_PRIVATE_EVENT_KEY"
export PORT=4177
node src/server.mjs
```

Open **http://localhost:4177/** in a browser. Choose Movie night, Opposite playlists or Book club, edit the two groups' examples, select **Fair to both groups** or **Discover something new**, then submit. The app reports a visible error until the key is configured. It never pretends mock data is live.

For verification:

```bash
node --test tests/*.test.mjs
node --check src/server.mjs
node --check src/agent.mjs
node --check src/qloo.mjs
node --check public/app.js
npm run check
npm test
```

After you receive and configure your **private** Qloo event key, check the real external API with:

```bash
npm run verify:qloo                  # verifies movie, artist, and book
npm run verify:qloo -- movie         # optional single-category check
npm run verify:qloo -- artist
npm run verify:qloo -- book
```

Each verification makes actual upstream `/search` and `/v2/insights` requests with category-specific cultural anchors. The default command checks all three categories in sequence and stops on any failed check. It fails if the key is absent, either input cannot be resolved or the two independent insights results are empty. It reports no credential. **This command has not passed against a real key in this environment.**

`npm test` and `npm run check` are equivalent when npm is available. The test suite uses deterministic Qloo-shaped **mocks**, not live API data. Do not represent these as a real integration test.

## Deploy a public website

A `render.yaml` is provided for a Node web service on Render. Publish this repository as **public** on GitHub, connect it to your Render account, and set secret `QLOO_API_KEY` in Render's private environment settings. Deploy, then check the public site in one command:

```bash
npm run verify:deploy -- https://YOUR-HOST.onrender.com
```

This checks actual HTTP responses, assets, app identity, security headers and secret presence. It does **not** call Qloo. You must still run the live smoke test and interact with the public app.

Also check `https://YOUR-HOST/api/readiness` returns HTTP 200 and `qlooConfigured:true`, and run real plans in a private browsing window. `/api/readiness` returns HTTP 503 when the key is missing, so the host should not claim an unconfigured deployment is healthy. A ready status means **only that a key is present**, not that the remote Qloo service accepted it: first run `npm run verify:qloo` and verify the public browser flow end to end.

Alternatively any Node.js hosting provider supporting server-side environment variables and publicly accessible HTTP on the `PORT` variable will work.

**Do not submit a localhost URL.** The hackathon requires a publicly hosted, end-to-end working demo, a public GitHub/GitLab/Bitbucket repo, and a visible open-source license. No demo video is required. [Official event instructions](https://qloo.devpost.com/).

## API routes

- `GET /api/health`: always-200 process liveness (key presence also shown), **not** authentication verification.
- `GET /api/readiness`: 503 until `QLOO_API_KEY` is configured. It never claims a successful live Qloo test.
- `POST /api/resolve`: JSON body with `groupA` and `groupB`; returns up to five Qloo entity choices per input for a human to confirm.
- `POST /api/plan`: JSON `{"groupA":"movie: Interstellar, artist: Daft Punk","groupB":"movie: Spirited Away, artist: BTS","category":"movie"}`.

The backend enforces bounded inputs, no cross-origin form submissions, a conservative request rate cap, short outbound timeouts, backoff for 429/5xx, and a 10-minute in-memory Qloo response cache. The server's readiness check does not send upstream calls, to avoid consuming Qloo quota or leaking status details during frequent host health probes. No passwords, user accounts or profile persistence are required.

## Known limitations (don't overclaim)

- Live API calls **have not been tested** until an event key is configured. Real event API response shapes, quotas, and category support must be verified with your assigned key.
- Search picks the first candidate when it cannot find an exact name match; the response includes an `exact` field. Cross-check surprising name resolutions.
- If the two independent Qloo top lists don't intersect, **no verified two-sided recommendations** are shown. Suggestions from the combined query are explicitly labeled exploratory.
- Balance scores are a local *relative-rank heuristic*. They are not scientific personal taste predictions.
- Qloo data represents aggregate taste relationships, not individual preferences or certainty of enjoyment.
- API credits/rate limits may prevent making an unlimited number of free plans.
- Live demo, public repository, and final Devpost submission require manual account actions. The project's local code alone is **not an eligible final submission**.

## Acknowledgments

Built independently using Qloo's developer documentation and the Qloo API; no third-party datasets or sample Qloo responses are republished. MIT license.
