# ORBIT-LENS — M7 accessibility audit

## Status and scope

Status: **Not yet audited on the running application.**

Target: WCAG 2.2 Level AA, including applicable Level A criteria.
This document is an audit protocol, not a conformance statement.

Scope includes the landing page, search, viewer, timeline, quality controls,
SED drawer, 3D modes, overlays, dialogs, errors, and embedded workspace.
Optional modes must either be accessible or have an equivalent accessible
workflow without requiring users to operate the inaccessible mode.

Preserve M0–M6 and CIDS. Do not move WCS, FITS, celestial transformations,
or SNR computation into frontend accessibility helpers.

## Governing playback requirement

Mission requirements take precedence over the advisory rate proposal in
`Aesthetics_guideline.md`:

- `isPlaying: false` at startup.
- Default 0.5 fps.
- Hard ceiling 3.0 Hz.

Define and measure the ceiling in displayed image transitions per second;
do not interpret it as permission for three two-frame cycles per second.
Rate limiting alone does not establish compliance with WCAG 2.3.1.
Assess actual displayed output, including manual scrubbing and video edits.

Display a caution before playback and provide an obvious pause control.
Provide static inspection and a static comparison alternative without
crossfading epochs into invented intermediate measurements.

## Audit procedure

1. Record commit, viewport, browser, operating system, input device, and
   assistive technology.
2. Exercise the entire workflow using keyboard alone.
3. Repeat the core workflow with a screen reader.
4. Inspect rendered contrast, zoom, reflow, forced colors, and reduced motion.
5. Review flashing risk using representative high-contrast observations.
6. Run available automated accessibility scans across all relevant states.
7. Evaluate every WCAG 2.2 A/AA success criterion. The matrix below is a
   risk-focused starting point, not an exhaustive conformance checklist.
8. Record pass, fail, or not applicable with evidence and justification.

## Priority checks

All checks below are pending.

| Area | Required evidence | Relevant criteria |
| --- | --- | --- |
| Structure | Landmarks, headings, labels, relationships, meaningful reading order | 1.3.1, 1.3.2, 2.4.6 |
| Canvas alternatives | DOM metadata, epoch controls, and equivalent access to essential information | 1.1.1, 1.3.1 |
| Color and contrast | Rendered text and controls measured on actual backgrounds, including focus | 1.4.1, 1.4.3, 1.4.11 |
| Reflow | Controls work at 320 CSS px and 400% zoom without page-wide overflow | 1.4.10 |
| Text | 200% text resizing and user text-spacing overrides retain content and controls | 1.4.4, 1.4.12 |
| Keyboard | Search, epochs, playback, drawers, overlays, and alternatives work without a pointer | 2.1.1, 2.1.2 |
| Focus | Logical order, visible indicator, no focused control entirely hidden by sticky UI | 2.4.3, 2.4.7, 2.4.11 |
| Bypass | Skip navigation reaches the main workspace | 2.4.1 |
| Pointer | No essential drag-only workflow; adequate target size or valid exception | 2.5.7, 2.5.8 |
| Accessible names | Visible control wording is included in the accessible name | 2.5.3 |
| Hover content | Supplemental content is dismissible, hoverable, and persistent as required | 1.4.13 |
| Errors | Invalid fields have clear associated text and useful correction guidance | 3.3.1, 3.3.2, 3.3.3 |
| Component state | Names, roles, expanded/selected state, and values are exposed | 4.1.2 |
| Status | Search/loading/error results are announced appropriately without focus theft | 4.1.3 |
| Motion | Paused start, working pause, no unintended autoplay | 2.2.2 |
| Flashing | Actual output assessed; rate cap is not treated as certification | 2.3.1 |
| Demo media | Accurate synchronized captions and necessary visual descriptions | 1.2.2, 1.2.3, 1.2.5 |

The project target is 44 × 44 CSS-pixel touch areas. WCAG 2.2 AA target-size
evaluation uses criterion 2.5.8 and its exceptions; do not conflate the two.

## Scientific viewer requirements

Keep the following accessible in DOM text, not solely in a canvas HUD:

- Active SourceBadge.
- Selected observation time and its supplied time scale.
- Detector and available spectral context.
- Stretch and shared/independent comparison treatment.
- Invalid-pixel, coverage, and quality information.
- Available orientation/scale information supplied by the backend.

Do not fabricate missing metadata or derive celestial values in JavaScript.
Explain unavailable information explicitly.

SED information needs an accessible structured representation of the
available backend values and units, including missing/flagged values.
Three-dimensional presentation must not be the only way to select or inspect
observations.

## Interaction test fixtures

Exercise:

- Zero, one, two, and many observations.
- Long identifiers and missing metadata.
- Mixed quality, invalid pixels, and partial coverage.
- Explicit synthetic data.
- Real archive success when available.
- Archive failure and stale-response races.
- Every supported source label.
- Deep links, invalid URL values, and embedded mode.
- WebGL unavailable or context lost.
- Reduced motion and forced colors.
- Keyboard-only and touch operation.

An unavailable archive is a recorded limitation, not permission to substitute
synthetic results under a real-data badge.

## Evidence and defect record

For each finding record:

    ID:
    Commit:
    Page/state/source:
    WCAG criterion:
    Browser/assistive technology:
    Steps:
    Expected:
    Actual:
    Evidence:
    Severity:
    Owner:
    Fix:
    Retest result:

Severity guidance:

- Critical: unsafe flashing behavior or inaccessible core workflow.
- High: an applicable A/AA failure preventing a material task.
- Medium: other applicable A/AA failures.
- Low: usability improvements beyond the conformance target.

Severity does not waive a WCAG requirement.

## Release gates

- [ ] All applicable A/AA criteria have evidence-backed outcomes.
- [ ] All conformance failures are resolved before any AA conformance claim.
- [ ] Playback, wheel scrubbing, and video flashing risk are reviewed.
- [ ] Source and selected epoch remain visible at supported widths.
- [ ] Keyboard and screen-reader workflows are verified.
- [ ] Static comparison and non-canvas inspection paths are verified.
- [ ] Regression suites and production build pass.
- [ ] Demo captions, transcript, and visual descriptions are reviewed.
- [ ] Remaining non-conformance limitations are disclosed precisely.

Until these gates are satisfied, publish “Targets WCAG 2.2 AA; audit pending,”
not “WCAG 2.2 AA compliant.”