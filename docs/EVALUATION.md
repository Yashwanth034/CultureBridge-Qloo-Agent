# Competition readiness and evaluation record

> Snapshot: October 24, 2026. This document is deliberately conservative. A passing local test does **not** mean a winning entry, a valid live API key, an externally working deployment, or organizer acceptance.

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

- 29 automated tests passed on Node 20 on October 25, 2026, including HTTP server security headers, basic UI file delivery, response contract, mocked Qloo calls, caching, missing credentials, bad IDs, the 404 no-result search case, two strategies, no-overlap honesty, and genuine two-list agreement sorting.
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
