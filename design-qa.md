# Voxel rook design QA

## Evidence

- Source visual truth: `output/rook-reference.png`
- Rendered implementation: `output/rook-design-qa-full.png`
- Focused side-by-side comparison: `output/rook-design-qa-comparison.png`
- Route/state: `http://127.0.0.1:5002/`, active Voxel 3D match, Trained AI opponent, opening position
- Browser viewport: 1200 × 1000 CSS px at device density 1
- Source pixels: 1000 × 990 (proportionally reduced from the supplied 1748 × 1730 screenshot)
- Implementation pixels: 1200 × 1000
- Focus normalization: the reference's hero rook and the implementation's black a8 rook were isolated, enlarged, and padded to equal-height comparison panels. This preserves the expected gameplay-distance rendering instead of pretending the board piece is an isolated product render.

## Findings

No actionable P0, P1, or P2 findings remain.

- Silhouette: the gameplay rook has the reference's broad stepped footing, narrow tapered tower, expanded collar, and deep castle crown.
- Crenellations: six substantial radial merlons remain readable from the board's freely orbiting camera instead of collapsing into a generic four-corner icon.
- Surface detail: the rook now uses the native micro-voxel density used by the pawn, knight, bishop, queen, and king. Interior voxels are culled after construction to keep the added exterior detail economical.
- Materials: light and dark teams inherit the existing ivory/black stone palettes, while the foundation and crown course use the existing antique-gold accent material.
- Proportion: the new sculpt keeps the established Staunton height ratio (`rook = 0.68 × king`) requested for realistic relative piece heights. The reference's tower is therefore translated into the app's set proportions rather than copied at queen height.
- Gameplay readability: both colors remain distinguishable from adjacent pawns and knights at the normal camera distance, and the crown remains recognizable after zooming and orbiting.
- Console/render check: the active match rendered without browser console errors.

## Intentional deviations

- The reference is a studio-lit, isolated black-stone concept sheet; the implementation must render both player colors on a live wooden board.
- The concept rook is exaggerated vertically. The implementation keeps the real-world relative height system already applied to the full chess set.
- Antique-gold accents are supplied by the app's shared material system, so their hue and reflectance match the other pieces rather than the reference photograph exactly.

## Comparison history

### Pass 1

- [P2] The previous rook used the old coarse voxel blueprint and did not match the finer voxel density of the rest of the rebuilt set.
  - Fix: rebuilt the rook natively at micro-voxel resolution and added it to the native blueprint list.
- [P2] The previous crown was a shallow square rim with small edge blocks.
  - Fix: replaced it with six radial 5 × 5 merlons, three voxels tall, leaving deep readable notches.
- [P2] The previous body was a plain box with minimal hierarchy.
  - Fix: introduced a stepped gold-footed plinth, tapered/fluted tower, turned collar rings, and a gold crown course.

### Pass 2

- Post-fix evidence: `output/rook-design-qa-full.png` and `output/rook-design-qa-comparison.png`.
- The reference characteristics survive at gameplay scale, the rook respects the existing set's height system, and no P0/P1/P2 mismatch remains.

## Primary interactions tested

- Start a Voxel 3D match with the local Trained AI provider.
- Orbit and zoom the WebGL board.
- Confirm the light and dark rooks render in their correct starting squares.
- Confirm adjacent pieces, board controls, and the match sidebar remain usable.

## Implementation checklist

- [x] Match the stepped fortress base and tapered tower.
- [x] Add refined collars and antique-gold accent courses.
- [x] Build six deep, radial crenellations.
- [x] Preserve the established real-world height ratio.
- [x] Use native micro-voxel density and interior culling.
- [x] Verify the result in the live WebGL board.
- [x] Compare the source and implementation in one focused image.

## Follow-up polish

- P3: a future dedicated piece-inspection mode could show the rook at studio scale without changing its gameplay dimensions.

final result: passed
