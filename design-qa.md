# Design QA — TenderFlow landing hero

- Source visual truth: `/var/folders/s6/77rp_7mn3cngz8ythy3sn4y00000gn/T/TemporaryItems/NSIRD_screencaptureui_xrGLZH/Snímek obrazovky 2026-08-25 v 23.23.43.png`
- Rendered implementation: `/private/tmp/tenderflow-landing-implementation.png`
- Combined comparison: `/private/tmp/tenderflow-design-qa-comparison.jpg`
- Route: `/`
- State: desktop, dark theme, story step `02 / Nabídky` active, cookie banner visible in the raw implementation capture and excluded from the normalized comparison crop
- Source pixels: 934 × 906
- Implementation pixels: 1440 × 1088 at the browser's default desktop CSS viewport and 1× screenshot density
- Comparison pixels: 1568 × 809; both references were proportionally downsampled to a shared maximum height of 900 px without stretching

## Findings

No actionable P0, P1 or P2 mismatch remains. The supplied image is a style reference rather than a literal page specification, so differences in subject and layout are intentional: TenderFlow keeps its existing logo, navigation, enterprise content and dark product identity while adopting the reference's tactile landscape, sculptural mass, mineral materials and embedded functional controls.

## Required fidelity surfaces

- Fonts and typography: Manrope replaces the Inter/Instrument Serif pairing on the landing page. The hero uses an upright sans hierarchy with correct Czech diacritics, deliberate line breaks and readable UI weights. No serif or italic display treatment remains in the new hero.
- Spacing and layout rhythm: the desktop hero uses a two-column composition with a 36 px landscape radius, clear headline/CTA grouping and a five-step control anchored to the visual mass. At the 1120 px breakpoint it stacks; at 768 px the controls become a horizontally scrollable row.
- Colors and tokens: deep graphite and forest surfaces, mineral ivory imagery, sage emphasis and cobalt interaction states match the selected direction while retaining sufficient foreground contrast. The original orange remains only inside the unchanged product logo.
- Image quality and asset fidelity: the project asset is an original 1586 × 992 architectural render compressed to a 385 kB JPEG. It contains no baked-in text, logo or controls. Real HTML controls sit above it, preserving accessibility and responsiveness. The crop is sharp at the desktop viewport and has a defined mobile focal position.
- Copy and content: all trial, free-account and public-registration claims were removed from the landing conversion path. Primary conversion is consistently `Domluvit ukázku`. The five tender phases use product-specific Czech copy.

## Interaction and runtime evidence

- `05 Smlouva` was activated in the browser and updated the live story panel to `Každé rozhodnutí má dohledatelnou historii.`
- Navigační i hero CTA `Domluvit ukázku` používají skutečný odkaz. Sekundární hero CTA bylo po uživatelské revizi odstraněno.
- Browser console contained no application errors. The only warning was the expected unauthenticated `getCurrentUser: No session user` message on the public route.
- Reduced-motion CSS disables animated marquee and control transitions.

## Full-view comparison evidence

The combined board confirms the shared art direction: a dark green field, a large rounded presentation surface, layered physical terrain, an architectural focal object and small functional controls integrated into the mass. TenderFlow intentionally shifts the source's near-white dominant panel toward a darker enterprise product canvas so the unchanged orange logo and existing site sections remain coherent.

## Focused region comparison evidence

No additional crop was required. At 1440 × 1088 the combined full-view board keeps the original logo, headline, story panel, five process controls, material texture and building model readable at inspection scale. The source has no reusable product UI detail that needs a closer one-to-one match.

## Comparison history

- Initial generated asset used only documents and an abstract decision platform. It did not express the requested construction landscape strongly enough (P2).
- Fix: regenerated the asset with layered topography, a foundation excavation and a building transitioning from structural frame to finished facade, while preserving the process path and negative space.
- Post-fix evidence: the implementation capture and combined comparison show the construction narrative immediately, with real story controls layered over the model.

## Follow-up polish

- P3: after gathering production analytics, the headline may be tightened by one line on mid-width desktop screens if the demo CTA falls below the preferred first-fold position.
- P3: the mobile visual capture should be repeated in a clean 1× browser surface because the connected Chrome profile applied a non-standard visual scale during the temporary 390 × 844 check; mobile DOM order and breakpoint behavior were still verified.
- P3: a future iteration can crossfade five landscape states so the construction visibly progresses with the selected tender phase. This intentionally remains out of the current performance-focused scope.

## Implementation checklist

- [x] Preserve original TenderFlow logo asset.
- [x] Use a project-owned raster hero asset with no baked-in UI.
- [x] Keep story steps keyboard-accessible and stateful.
- [x] Remove trial and public-registration conversion copy.
- [x] Verify desktop render, primary interaction and browser errors.
- [x] Add reduced-motion behavior and responsive layout rules.

final result: passed
