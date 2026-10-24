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

- 21 automated tests passed on Node 20 on October 24, 2026, including HTTP server security headers, basic UI file delivery, response contract, mocked Qloo calls, caching, missing credentials, bad IDs, the 404 no-result search case, two strategies, no-overlap honesty, and genuine two-list agreement sorting.
- JS syntax validation: passed.
- Browser: the new immersive web interface, live Three.js render, Qloo identity-review stage, and results were inspected in Chrome. An independent **mock-only** local server supplied test entities and rankings during interaction checks. This does not verify real Qloo. The real server correctly reports that no event key is configured.
- Public GitHub code repository has been created.
- **No real-key Qloo request has been verified; no public hosted demo is online yet.**

## Mandatory live API validation

After obtaining your key via Qloo's event Google Form:

1. Set `QLOO_API_KEY` in your secure server environment; never paste the key into Devpost, GitHub, or public browser JavaScript.
2. Check `GET /api/health`: `qlooConfigured: true` proves only a key was supplied.
3. Run 3 scenario briefs on the public host, at least one each: movie, artist, book.
4. Confirm `GET /search` returns valid UUIDs, categories map correctly, and typed input selects the intended entity.
5. Confirm `GET /v2/insights` returns usable entities for both independent sides and for the joint query, that results vary with input, and that the app completes in a reasonable time.
6. Test wrong key (rejected without leaking it), malformed names, no overlap, missing results, and an ambiguous seed.
7. Confirm HTTPS website is publicly accessible in incognito, on desktop and mobile, without login and without browser console errors.

## Submission gates

- [x] MIT license added.
- [x] Public source repository prepared; project pushed to GitHub.
- [x] User-facing web application and safe server in place.
- [x] Initial automated local tests and browser visual smoke test passed.
- [ ] Qloo event key configured and **real** end-to-end response verified.
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
