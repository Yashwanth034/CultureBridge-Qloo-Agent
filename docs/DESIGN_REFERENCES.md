# CultureBridge — visual direction and reference decisions (24 October 2026)

This file records the user's reference sites, how they informed the actual app, and what was intentionally not copied. We do **not** claim to have installed every inspiration library; a consistent, performant experience is more useful to hackathon judges than a catalogue of visual effects. The implementation is original.

## The product idea drives the visual concept

**Two different taste signals converge into one shared cultural discovery.** On the working page, an original Three.js pair of woven, iridescent ribbons literally crosses and converges. Its joining state changes through the app's Qloo resolution, analysis, and recommendation stages. When a user selects a result, the central shared signal responds to the strength of our *relative-rank heuristic* (not a fabricated probability). The animated centerpiece is backed up by an accessible CSS fallback.

The form keeps the user in control: a native-select review screen explicitly confirms Qloo identities before independent and joint insights are requested. Recommended entities remain legible DOM text with source positions and an inspectable explanation.

## Design references the user supplied

| Inspiration | Concrete influence / reason to avoid direct reuse |
| --- | --- |
| [Jiro](https://jiro.build/) | Looked for expressive, non-template conceptual art direction. We built our own single central visual metaphor instead of pasting a design prompt. |
| [Awwwards](https://www.awwwards.com/) | Large typographic hierarchy, visual pacing, immersive first screen; typography is now 46–76px in the hero rather than a small dashboard header. |
| [Godly](https://godly.website/) | High-craft landing-to-product continuity. Instead of a standalone marketing site, the experience starts with working inputs. |
| [60fps.design](https://60fps.design/) | Short spatial reveal for stage changes, scroll behavior, micro-feedback. Respects reduced motion. |
| [21st.dev](https://21st.dev/) | Layered depth and glass materials used selectively on the taste cards and evidence surface. No external React component was copied. |
| [Aceternity UI](https://ui.aceternity.com/) | Subtle highlighted focus/hover interactions. We deliberately avoided adding several competing spotlight effects. |
| [Magic UI](https://magicui.design/) | Restraint in glow, moving focus, and border emphasis. Only primary actions and meaningful connections are accented. |
| [Three.js](https://threejs.org/) | Real implementation via pinned `three@0.181.0` ESM for two custom parametric ribbon meshes and a converging center; no third-party 3D models or textures. |
| [Shadertoy](https://www.shadertoy.com/) | Shader-experiment inspiration. We avoided unlicensed shader snippets and used Three.js geometries/materials, because predictable rendering and app performance matter more than heavy postprocessing. |
| [Component Gallery](https://component.gallery/) | Accessible native select/label patterns for identity review and output selectors; no hand-rolled inaccessible combobox. |

Additional references from the earlier list—[Motion In Design](https://motionin.design/), [Landdding](https://landdding.com/), [Land-book](https://land-book.com/), [Supahero](https://www.supahero.io/), [CTA Gallery](https://cta.gallery/), [Footer Design](https://www.footer.design/), [Grainient](https://grainient.supply/), [Backgrounds Supply](https://backgrounds.supply/) and others—were creative references, not a requirement to install third-party assets. No paid design source, illustration, or stock graphic was copied. The page is generated through code and uses CSS, text, and original Three.js geometry.

## Product-quality guardrails

- The main choices and explanations are comfortably readable on desktop; ordinary content text is 14–18px or larger.
- The 3D canvas has `aria-hidden`, cannot intercept input, and never determines API results.
- Loading, identity review, results, and real-key errors have distinct states. No fabricated "live" data on the production server.
- The original user problem—two groups finding culturally grounded common ground—remains obvious before any interaction.
- The optional 3D CDN fails gracefully to CSS artwork; keyboard use remains independent of WebGL.
- No claims of an 85% winning chance. We need real Qloo API validation, anonymous public deployment, and a completed Devpost submission.

## Release reminder

A local mock server was used exclusively to inspect UI interactions. It must not be deployed or presented as Qloo data. Only `node src/server.mjs` belongs in the public deployment. The hackathon API key must remain in the host's private environment.
