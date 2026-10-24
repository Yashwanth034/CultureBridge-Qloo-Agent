# Draft Devpost submission — CultureBridge

> **STATUS: DRAFT, NOT SUBMITTED.** Replace bracketed placeholders only after the public website and repository exist. Verify actual Qloo calls with a real event key before claiming full functionality. Project authors should review and own the entry.

## Project name

CultureBridge — Different tastes. One great night.

## Tagline

An evidence-first cultural mediation agent that finds shared film, music, and book experiences for groups who like different things.

## Inspiration

Planning an activity across different tastes often ends in a boring compromise: the biggest personality picks, the quieter person settles, and everyone misses the cultural overlap neither group could have found alone. Clubs, friend groups and community event organizers need a fairer way to plan shared experiences. Recommendation chatbots can invent culturally plausible but unverified answers.

## What it does

CultureBridge listens to **two independent audience taste profiles**. Each person or group can contribute movies, music artists, or books they enjoy. A Qloo-powered agent resolves real cultural entities, gathers separate recommendation lists for each group, and scouts the combined taste space. It prioritizes opportunities independently supported for **both** groups. Each recommendation shows the two original list positions and a transparent balance ranking. When there is no independent overlap, it doesn't pretend there is one: joint-signal discoveries are marked exploratory.

Users can switch between movie-night, shared music, and book-club outcomes. They can choose a fairness-first or discovery-first mediation style, and compare the outcome against each group’s unmediated first choice to visualize how a taste-equity approach changes the decision. One click exports an evidence report that explains what was considered.

## How we built it

- **Live Qloo /search** resolves typed cultural signals into Qloo entities.
- **Live Qloo /v2/insights** makes three sequential queries (group A, group B, and both together), with documented filter/type, excluded input IDs, and explainability request.
- **Adaptive agentic workflow:** validate → resolve → independently scout → jointly explore → expand Qloo searches when first-pass overlap is empty → deterministic fairness evaluation.
- **Fairness objective:** independently returned picks earn a conservative, relative rank-based maximin score. Discovery mode also rewards strength in a separate joint Qloo ranking, while requiring independent support from both groups. Picks found only in the joint set stay exploratory. For zero verified overlap, the interface explicitly marks the strongest joint-only possibility as **not verified for both**, offers another category, and never invents a pick. Relative rankings are never labeled probabilities or Qloo's own affinity.
- **Node 20+ server**, server-only event key, no third-party runtime dependencies, rate control, retries and caching.
- **Immersive responsive product:** an original Three.js 3D scene shows two interwoven taste streams connecting, while readable profile cards and evidence panes remain accessible native HTML. Stage transitions and selected-recommendation strength affect the scene; reduced-motion/WebGL fallback requires no 3D rendering. No templates or artwork were copied.
- **Human-in-the-loop confirmation:** after resolving inputs via Qloo /search, the app offers matching alternatives. Users select the actual cultural entities before the agent requests Qloo Insights.

## Challenges

Resolving ambiguous culture entity names, designing a scoring process that doesn't overpromise on aggregate affinities, dealing with rate limits, and differentiating true common ground from merely plausible shared suggestions.

## Accomplishments

- A coherent, interactive end-to-end application.
- Transparent, inspectable Qloo-integration code and ranking pipeline.
- Explicit error states for missing keys, missing matches, and absent independent overlap.
- Local automated tests and browser smoke checks. **Do not claim verified live Qloo operation until a live key test passes.**

## What's next

Support three or more audience groups, explicit venue and licensing constraints, human voting on proposed plans, and richer Qloo-affinity evidence after further live validation.

## Technical details and judging

**What only Qloo makes possible:** independently scouted, entity-identified, cross-domain cultural connections. There are no hardcoded recommendation cards or fabricated live candidates.

**Practical audience:** university student club organizers, community event organizers and two-sided friend groups.

**Trust limitations:** cultural affinity data is aggregate; actual personal satisfaction isn't predicted or guaranteed. Rankings are relative and cannot prove real-world preferences.

## Repository

https://github.com/Yashwanth034/CultureBridge-Qloo-Agent

## Functional public demo

[INSERT HOSTED APP URL HERE]

## Test instructions for judges

1. Open the public app and verify the Qloo connection banner is green.
2. Click "Movie night", then "Find our connection".
3. Review Qloo's resolved identities for each person's tastes; choose the correct match when Qloo shows multiple options.
4. Click "Reveal our shared discoveries" to run the independent and joint live Qloo insights requests.
5. Inspect a result in the shared shortlist to compare the evidence from both perspectives.
6. Try "Different playlists" with artists, or "Book club" with books.
7. Expand the agent's reasoning section to examine the decision trail.
8. Change one taste seed and regenerate to see live taste differences.
9. Export the evidence report. If no independent match appears, the app correctly labels joint-only suggestions exploratory.

## Before pressing Submit — required checklist

- [ ] Confirm eligible country, adulthood, and participation rules
- [ ] Request event key via the [official Qloo Agentic Hackathon Google Form](https://forms.gle/zz12orkLHTAneLGz6); enter personal details yourself and accept the terms, then store the issued key in the hosting secret manager, never in the repository
- [ ] Verify real Qloo requests (search and insights) with `npm run verify:qloo` and actual private event key, correct status and response structure
- [ ] Public website runs correctly for an anonymous judge (no password, no localhost); run `npm run verify:deploy -- https://YOUR-HOST.onrender.com --live` for the full public Qloo search → review → recommendation path
- [x] Repository is public and has README, all source, and MIT LICENSE committed. Check that GitHub detects the license in the repository About area.
- [ ] Test responsive UI, bad inputs, and the three output categories on published site
- [ ] Check public demo/source URLs in an incognito session
- [ ] Complete all fields and final submission on Devpost before 30 October 2026 11:45 PM EDT
- [ ] Be available for finalist preparation and the 5 November live presentation, if shortlisted

**Do not list the extra $25,000 investment opportunity as a guaranteed cash prize.** It is a separate optional investment announcement with unknown terms.

Useful official references:
- https://qloo.devpost.com/
- https://qloo.devpost.com/rules
- https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
