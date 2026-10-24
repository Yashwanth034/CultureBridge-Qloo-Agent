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

Users can switch between movie-night, shared music, and book-club outcomes. One click exports an evidence report that explains what was considered.

## How we built it

- **Live Qloo /search** resolves typed cultural signals into Qloo entities.
- **Live Qloo /v2/insights** makes three sequential queries (group A, group B, and both together), with documented filter/type, excluded input IDs, and explainability request.
- **Agentic five-phase workflow:** validate → resolve → independent scout → joint explore → deterministic fairness evaluation.
- **Fairness objective:** independently returned picks earn a conservative, relative rank-based maximin score. Picks found only in the joint set stay exploratory. Relative rankings are never labeled probabilities or Qloo's own affinity.
- **Node 20+ server**, server-only event key, no third-party runtime dependencies, rate control, retries and caching.
- **Responsive interface** using accessible HTML/CSS/JavaScript with explanations and an evidence-export control.

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

[INSERT PUBLIC GITHUB REPOSITORY LINK HERE]

## Functional public demo

[INSERT HOSTED APP URL HERE]

## Test instructions for judges

1. Open the public app and verify the Qloo connection banner is green.
2. Click "Movie night", then "Find the common ground".
3. Inspect results with independent Qloo rankings for each profile.
4. Try "Opposite playlists" with artists, or "Book club" with books.
5. Expand "Agent decision trail" to view the agent steps and provenance.
6. Change one taste seed and regenerate to see live taste differences.
7. Export the evidence report. If no independent match appears, the app correctly labels joint-only suggestions exploratory.

## Before pressing Submit — required checklist

- [ ] Confirm eligible country, adulthood, and participation rules
- [ ] Request event key from official Qloo hackathon form; put it in server secret manager, never in repository
- [ ] Verify real Qloo requests (search and insights) end-to-end, correct API status and response structure
- [ ] Public website runs correctly for an anonymous judge (no password, no localhost)
- [ ] Repository is public and has README, all source, and MIT LICENSE visible in repository About
- [ ] Test responsive UI, bad inputs, and the three output categories on published site
- [ ] Check public demo/source URLs in an incognito session
- [ ] Complete all fields and final submission on Devpost before 30 October 2026 11:45 PM EDT
- [ ] Be available for finalist preparation and the 5 November live presentation, if shortlisted

**Do not list the extra $25,000 investment opportunity as a guaranteed cash prize.** It is a separate optional investment announcement with unknown terms.

Useful official references:
- https://qloo.devpost.com/
- https://qloo.devpost.com/rules
- https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
