# Competition readiness and evaluation record

> Snapshot: October 25, 2026. This document is deliberately conservative. A passing local test does **not** mean a winning entry, a valid live API key, an externally working deployment, or organizer acceptance.

## Judging criteria, from the official Qloo Devpost rules

1. **Technological implementation**: nontrivial use of Qloo, a genuine working application.
2. **Design**: cohesive, complete product experience, rather than a technical demo.
3. **Potential impact**: credible, specific audience and problem addressed by demonstrated functionality.
4. **Originality**: creative, non-obvious use of cultural intelligence.

All four are equally weighted. The judges decide. There is no defensible external way to claim an 85% winning chance.

## Our product argument

**Audience**: campus clubs, small community event organizers, and friend groups making film, artist, or book event choices.

**Problem**: conventional group recommendations often choose one person's favorite, erasing minority tastes. Individual preferences may have hidden affinities across cultural domains.

**Solution**: Qloo resolves each group's inputs and provides independent Qloo rankings; an agent intersects verified candidates, probes a combined taste signal, and optimizes group parity versus joint discovery. It also shows the unmediated first choice for each group, identifying who might be excluded from that simple approach.

**Why not a generic chatbot?** The returned IDs, rankings, and agreement evidence come from Qloo endpoints. Without live Qloo data the app refuses to produce results. No static recommendation card or fabricated preference probability exists.

**Not a clinical / behavioral claim**: aggregate taste association is not guaranteed satisfaction for an individual. The “verified match” badge indicates only that Qloo returned an item in both independent top lists, not that both persons have actually tested or approved it.

## Present local verification

- 59 automated tests passed on Node 20 on October 25, 2026. Coverage now includes quote-aware cultural titles, conservative Qloo explainability parsing, preservation of separate input contributions, and an HTTP response test for evidence provenance. Coverage includes duplicate-ID rank stability, HTTP-level end-to-end flows for all three categories, optional joint-Insights outage recovery, exact propagation of valid Qloo-reported affinity data, rejection of malformed/non-numeric affinities, and strict real-Qloo preflight rejection of degraded runs. Unicode-safe HTTP JSON body decoding is tested with split UTF-8 bytes and a wire-byte-size limit. Concurrent identical Qloo lookups now share one in-flight promise, rejected calls fan out a single safe failure, and 404 no-match searches are cached for 60 seconds. These are verified with new regression tests. The external real-key API test remains pending.
- Chrome browser QA confirmed both the no-overlap state and the verified shared-result evidence panel. The new evidence view shows the exact cultural seeds selected by each side and **optional raw Qloo affinity values** from independent A, independent B, and joint Insights. It labels them as provider data, not a probability or a value directly comparable across different queries. Browser QA used a temporary Qloo-shaped mock process, not the real Qloo service; it was stopped afterward.
- API tests cover HTTP security headers, static delivery, request/response contracts, Qloo-shaped mocks, caching, missing credentials, invalid IDs, 404 no-result searches, both mediation strategies, no-overlap honesty, ranking and degradation transparency.
- The identity review now allows explicit exclusion of any Qloo match. Browser QA verified that excluding all matches on one side disables generation, and excluding only one taste preserves the other approved signals. The browser-to-API empty-option conversion was corrected after the first real browser run caught it; HTTP and agent regression tests now cover explicit null exclusions and reject silently rediscovering excluded entities.
- Render proxy-aware rate-limit keys use an explicitly configured trusted proxy chain; direct/local mode ignores user-supplied forwarded headers. A browser-facing deployment should confirm the real `CF-Connecting-IP` or expected right-hand forwarding chain to avoid a shared IP bucket for all visitors.
- Qloo transient connection resets now retry within strict bounds; API `Retry-After` is honored up to five seconds. Browser fetches time out after 90 seconds with actionable messages. These are tested against injected network failures and rate limits; live key behavior is still unverified.
- **Free Render hosting risk:** Render's documentation confirms that free web services spin down after 15 minutes idle and may take about one minute to restart. Judges may encounter a cold-start loading page. Where affordable, a paid web-service plan avoids this; otherwise verify a cold start in an incognito session before submission.
- Loading screens now have a **Cancel and edit tastes** action. Browser QA confirmed the cancel button returns to editing. Two Node VM tests exercise the real frontend script with deferred fetches: a cancelled response cannot overwrite the editing state, and an obsolete request cannot re-enable controls while a newer one runs. Browser aborts are not equivalent to cancelling an already-dispatched Qloo server request; upstream work may still consume quota.
- Chrome browser QA confirmed a source-evidence panel showing normalized Qloo-shaped contributions mapped back to approved tastes for A, B, and the joint signal. The temporary client supplied mock data only; no live Qloo event key was configured. Absent or ambiguous provider contributions remain hidden.
- JS syntax validation: passed.
- Browser: the new immersive web interface, live Three.js render, Qloo identity-review stage, and results were inspected in Chrome. An independent **mock-only** local server supplied test entities and rankings during interaction checks. This does not verify real Qloo. The real server correctly reports that no event key is configured.
- Public GitHub code repository has been created.
- **No real-key Qloo request has been verified; no public hosted demo is online yet.**

## Mandatory live API validation

After obtaining your key via Qloo's event Google Form:

1. Set `QLOO_API_KEY` in your secure server environment; never paste the key into Devpost, GitHub, or public browser JavaScript.
2. Check `GET /api/readiness`: HTTP 200 and `qlooConfigured:true` prove only a key was supplied. HTTP 503 means the hosted instance is not configured. Run `npm run verify:qloo` (checks movie, artist and book) on the real-key environment before promising the demo works.
3. Run 3 scenario briefs on the public host, at least one each: movie, artist, book.
4. Confirm `GET /search` returns valid UUIDs, categories map correctly, and typed input selects the intended entity.
5. Confirm `GET /v2/insights` returns usable entities for both independent sides and for the joint query, that results vary with input, and that the app completes in a reasonable time.
6. Test wrong key (rejected without leaking it), malformed names, no overlap, missing results, and an ambiguous seed.
7. Run `npm run verify:deploy -- https://YOUR-HOST.onrender.com` to check actual hosting and key presence, then `npm run verify:deploy -- https://YOUR-HOST.onrender.com --live` to test the public Qloo entity review and Insights workflow for movie, music and book. Confirm the app also works in incognito on desktop/mobile, without login or browser console errors.

## Submission gates

- [x] MIT license added.
- [x] Public source repository prepared; project pushed to GitHub.
- [x] User-facing web application and safe server in place.
- [x] Initial automated local tests and browser visual smoke test passed.
- [x] Deployment readiness endpoint and Render health check configured.
- [x] Live Qloo and public URL verification scripts tested with mocks, but not yet against an event key or public deployment.
- [ ] User completes the official 2026 Agentic Hackathon [Qloo key request](https://forms.gle/zz12orkLHTAneLGz6), including personal details and agreeing to the API rules; no key found in the connected Gmail search at last check.
- [ ] Qloo event key configured **privately** and **real** end-to-end responses verified.
- [ ] Public app deployed and accessed anonymously, end to end.
- [ ] Final live environment tested for all three categories and strategies.
- [ ] User confirms age, residence eligibility, and event rules.
- [ ] Devpost project created, fully described and finally submitted before 30 Oct 2026 11:45 PM EDT (31 Oct 2026 09:15 AM IST).
- [ ] User available for online finalists' presentation on November 5 if shortlisted.

## Scope limits / no invented probability

The hackathon showed ~2300 registered participants when last reviewed and has three cash awards. Participation and submission counts differ; neither field lets us calculate an individual entrant's chance of winning. The app can be strengthened and we can evaluate it on test completion and rubric coverage, but a claim that winning is 85% likely would be ungrounded.

Sources:
- https://qloo.devpost.com/rules
- https://qloo.devpost.com/
- https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
