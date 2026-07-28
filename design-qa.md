# Kingside setup design QA

## Evidence

- Source visual truth: `/Users/diegocabezas2/Downloads/ChatGPT Image Jul 27, 2026, 06_43_38 PM.png`
- Rendered implementation: `/Users/diegocabezas2/Documents/code_projects/human_ai_chess/output/kingside-setup-final.png`
- Full-view comparison: `/Users/diegocabezas2/Documents/code_projects/human_ai_chess/output/design-qa-comparison-final.png`
- Focused controls comparison: `/Users/diegocabezas2/Documents/code_projects/human_ai_chess/output/design-qa-controls-focus.png`
- Route/state: `http://127.0.0.1:5001/`, setup dialog open, saved local profile selected, Codex selected, GPT-5.6-Sol selected, Voxel 3D selected
- Requested viewport: 1375 × 1144 CSS px
- Browser-rendered viewport: 1250 × 1040 CSS px at device density 1
- Source pixels: 1375 × 1144
- Implementation pixels: 1250 × 1040
- Density normalization: the source was proportionally normalized to 1250 × 1040 before full-view comparison. The controls focus comparison normalized both right-side regions to 750 × 1040.

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: Newsreader recreates the high-contrast editorial display face; Inter and IBM Plex Mono preserve the reference hierarchy for interface and technical copy. Heading weight, tracking, uppercase labels, line height, and wrapping are visually aligned.
- Spacing and layout rhythm: the 40/60 split, framed viewport, numbered timeline, control rhythm, rounded cards, matchup rail, and CTA placement match the reference. The player profile, fourth provider, and two board choices increase control density intentionally while remaining inside the frame without clipped persistent controls.
- Colors and visual tokens: the implementation matches the near-black, antique-gold, warm-ivory, and restrained green status palette. Border opacity, gold glow, selected states, and low-elevation shadows follow the reference.
- Image quality and asset fidelity: the generated black king uses the same subject, crop, radial geometry, gold rim light, and dark photographic treatment. It is a real raster asset rather than CSS or text art and is sharp at the rendered size.
- Copy and content: the reference copy is preserved where applicable. Product-required copy is added for the permanent local profile, Trained AI, Classic mode, and local-history privacy boundary.
- Interaction and accessibility: OpenAI/Codex provider switching, provider status copy, Classic/Voxel selection, model discovery, and the enabled start state were tested in the browser. Semantic radio groups, labels, visible focus styles, and status regions remain intact.
- Console check: no browser warnings or errors in the verified state.

## Intentional deviations

- The reference shows three providers; the implementation keeps the required fourth Trained AI provider.
- The reference omits player identity; the implementation keeps the required local username and permanent Elo selector.
- The reference shows only a voxel row; the implementation keeps both Classic and Voxel 3D choices.
- The source and implementation could not be captured at identical CSS dimensions because the connected in-app browser capped the rendered viewport at 1250 × 1040. The source was normalized proportionally, preserving the same aspect ratio.

## Comparison history

### Pass 1

- [P2] Hero image showed a visible rectangular boundary against the left panel.
  - Fix: expanded the asset edge-to-edge within the hero region and added a vertical mask so the image blends into the panel.
- [P2] Opponent-model helper copy aligned horizontally with the section title.
  - Fix: restored the title/helper column layout with a dedicated flex rule while retaining the Recommended badge.

### Pass 2

- Post-fix evidence: `output/design-qa-comparison-final.png` and `output/design-qa-controls-focus.png`.
- The hero now blends into the surrounding surface, the model title/helper hierarchy matches the other numbered steps, and no P0/P1/P2 mismatch remains.

## Focused region evidence

The right-side controls were compared separately because provider labels, model copy, selected-state borders, board-mode descriptions, matchup labels, and CTA typography were too small to judge confidently in the full 2500-pixel-wide comparison. The focused comparison confirms readable hierarchy, aligned gold timeline markers, consistent card radii, and reference-matched selected states.

## Primary interactions tested

- Switch from Codex to OpenAI and verify the hidden provider value, selected card, and provider note update.
- Switch back to Codex and verify GPT-5.6-Sol is selected.
- Select Classic, return to Voxel 3D, and verify the checked board-mode value.
- Verify the Start the match control is enabled for the existing local profile.

## Implementation checklist

- [x] Match the reference frame, split, palette, typography, and visual hierarchy.
- [x] Replace the text chess-piece hero with a high-resolution black-king asset.
- [x] Preserve player profile, four providers, model discovery, and both board modes.
- [x] Verify controls and runtime model state.
- [x] Run the application test suite.
- [x] Compare normalized full-view and focused-region evidence.

## Follow-up polish

- P3: a future dedicated 1375 × 1144 browser capture could remove the remaining evidence-only viewport normalization note; it does not affect the responsive implementation.

final result: passed
