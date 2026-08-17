# TF Space — design QA

**Visual truth**

- Source: `/Users/martinkalkus/.codex/generated_images/01a00c8c-2fae-7af1-a303-f7c4f89eb4a7/exec-7138fa56-2bf2-4d0d-932d-22f1eada8970.png`
- Rendered implementation: `docs/design/tf-space-electron.webp`
- Full-view comparison: `/tmp/tf-space-comparison-final.png`
- Focused comparison: `/tmp/tf-space-focused-final.png`
- State: Electron `desktop:dev`, authenticated project overview, dark mode, skin `space`, project `26034 Pyrum - spodní stavba`.
- Viewport: 1149 × 720 CSS px, `deviceScaleFactor: 2`.
- Source pixels: 1491 × 1055. The source is a raster design target without declared CSS density.
- Implementation pixels: 2298 × 1440, corresponding to 1149 × 720 CSS px at 2× density.
- Density normalization: both full views were fitted into equal 746 × 528 comparison cells without cropping. The focused comparison used the visible header/KPI/information/table regions and normalized both sides to 746 × 344.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Typography: the implementation preserves the compact sans-serif hierarchy, strong numeric KPI weights, uppercase micro-labels, readable line height, and Czech copy. The live application uses its existing Tender Flow type scale rather than reproducing mock-only text sizes pixel-for-pixel.
- Spacing and layout rhythm: the existing product shell has a wider project sidebar and more navigation destinations than the concept. Within that constraint, the KPI row, information surface, filter group, and dense table retain the same hierarchy and rhythm.
- Colors and tokens: black/navy surfaces, red-magenta-violet-blue space art, cyan data accents, amber statuses, subtle borders, and the red active control are visible. Text and dense data remain legible over translucent surfaces.
- Image quality: the generated WebP space canvas is sharp at the tested 2× capture, uses the intended red-to-blue orbit and star field, and is not replaced by CSS-drawn artwork. Appica's dot pattern and border beam are supplemental decoration.
- Copy and content: application copy remains real Czech project data. Differences from the concept's demo project are expected and do not alter the design hierarchy.

**Comparison history**

1. Initial comparison found P2 under-expression of the orbit artwork: the project overview root and opaque panels hid most of the space canvas. Fixed by making the TF Space overview root transparent, reducing only TF Space's canvas veil, and lowering KPI/information surface opacity while retaining blur and contrast. Post-fix evidence: `docs/design/tf-space-electron.webp` and `/tmp/tf-space-comparison-final.png`.
2. The next capture found a P1 hover-contrast regression and P2 footer drift: a hovered table row became white and the totals row became light gray. Fixed with explicit TF Space hover styles on both the row and cells and a dark translucent `tfoot` surface. Post-fix evidence: the cyan-tinted hovered `Štěrky` row and dark `Celková bilance` row in `docs/design/tf-space-electron.webp`.
3. Final comparison found no further actionable P0/P1/P2 issues. The remaining structural differences are intentional constraints of the existing Tender Flow shell and live data.

**Focused-region evidence**

- `/tmp/tf-space-focused-final.png` compares the header/navigation, KPI cards, information grid, and top of the demand table at readable scale.
- Appica control presence was also verified in the live pipeline route: navigation changed to `?tab=pipeline` and the `Nová Poptávka` button was present.

**Runtime checks**

- Primary interaction: project overview → `VÝBĚROVÁ ŘÍZENÍ` navigation succeeded.
- Appica button: `Nová Poptávka` was exposed with the expected accessible name on the pipeline route.
- Console: no runtime errors. One existing development warning remained: `[AuthContext] initAuth timed out (8000ms)`. React also displayed its standard DevTools development notice.

**Open Questions**

- None blocking. The concept includes a compact right-side global search panel that does not exist in the current Tender Flow information architecture; it was intentionally not invented as part of a theme-only change.

**Implementation Checklist**

- [x] Match the approved black/navy and red-blue space direction.
- [x] Preserve dense project data readability and interaction states.
- [x] Use the real generated space asset and Appica decorations/components/icons.
- [x] Validate overview and pipeline navigation in Electron.
- [x] Re-capture after every P1/P2 visual correction.

**Follow-up Polish**

- P3: a future dedicated compact-mode project layout could move closer to the concept's tighter sidebar and card proportions, but that would be a product-layout change rather than a skin change.

final result: passed
