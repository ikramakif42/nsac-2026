# M7 implementation and evidence status

## Delivered source

- Replacement Zustand store preserving existing CIDS-facing action names.
- Finite playback-rate normalization with a 3.0 fps ceiling.
- Integer epoch handling and bounded stepping.
- Pausing on search, source changes, non-ready status, and view changes.
- Full reset of source, view, display, drawers, and playback.
- Pure deep-link parsing, validation, and serialization.
- Accessible observation inspector with explicit playback opt-in.
- Provenance derived from the displayed observation when available.
- Separate requested-source context when old data remain displayed.
- Persistent warning and error text.
- Keyboard-operable static epoch selection and observation metadata.
- Reduced-motion, page-hide, and hidden-tab pause handling.
- Scoped responsive and forced-colors styles.
- Vitest cases for the store and deep-link utilities.

The inspector intentionally does not implement another animation scheduler,
fetch observations, transform coordinates, compute signal-to-noise ratios,
or infer observation time scales.

## Integration requirements

Mount M7Inspector alongside the existing viewer and pass the exact ordered
observation sequence used by that viewer. Keep the inspector mounted in
embedded views.

The renderer must set activeRecord only when its corresponding pixels are
displayed. Otherwise neither existing metadata nor this inspector can
reliably identify the visible image.

Use parseDeepLink at the existing URL-hydration boundary. Display returned
errors without issuing a substituted-source request. Pause before applying
accepted state.

Restore an epoch only after the matching requested observation sequence
arrives. If the index is unavailable, explain that explicitly rather than
silently showing a different index as restored.

Use createDeepLink at the existing share/export boundary. Its base argument
must be an absolute URL.

The store replacement applies immediately through existing imports.
The inspector and URL utilities require those application-level connections;
they are not automatically mounted by adding their files.

## Remaining runtime verification

The existing renderer and request lifecycle were not available for execution.
The following are unresolved release gates:

- Verify actual displayed transitions never exceed 3 per second.
- Verify one playback scheduler exists, with cleanup on pause and unmount.
- Verify hidden tabs do not accumulate a playback backlog.
- Verify canvas wheel bursts are coalesced and rate-limited.
- Verify wheel listeners preserve browser zoom and keyboard alternatives.
- Verify late archive responses cannot overwrite newer investigations.
- Verify deep links restore the correct source and comparison sequence.
- Verify a static side-by-side image comparison, not merely metadata.
- Verify all existing drawers and dialogs implement focus containment,
  Escape dismissal, accessible names, and focus restoration.
- Verify mask, coverage, stretch, overlay, and export provenance presentation.
- Verify the inspector's displayed-record contract against rendered pixels.

State-level fps clamping is not proof of rendered timing safety.

## Supplied test evidence

The latest supplied backend terminal excerpt ends with:

    132 passed, 1 warning in 2.76s

Its warning concerns WCS dimensionality in
test_fits_mef_uses_science_hdu_wcs_and_quality_extensions.

The accompanying “50/50” summary conflicts with that terminal count.
Use the terminal excerpt as the supplied result, not as a new execution.

The latest frontend diagnostic says FAILED / ERRORS but contains no
diagnostic output. Historical seven-test and 57-test statements do not
establish the current frontend result.

No new execution, build, browser audit, live archive request, or recording
was performed for these source files.

## Commands to run

From the repository root:

    cd backend
    python -m pytest
    cd ../frontend
    npm run test -- --run
    npm run build

Capture command exit codes, complete output, commit, OS, browser, Node,
npm, and Python versions.

## Accessibility review

Record outcomes for applicable WCAG 2.2 A and AA criteria. At minimum,
review:

- Full keyboard workflow with visible, unobscured focus.
- Screen-reader names, states, errors, and reading order.
- 320 CSS-pixel reflow and 200% text enlargement.
- Rendered text, control, and focus contrast.
- Forced colors and reduced motion.
- Touch target sizes and alternatives to dragging.
- Flashing risk in actual images, overlays, and exported video.
- Embedded-mode preservation of essential controls and provenance.
- Canvas-unavailable inspection and error states.

Automated scans supplement rather than replace this review.

## Media and submission

The existing demo-video document remains a recording script, not a video.
Final delivery still requires:

- A recording of the verified release.
- Synchronized reviewed captions.
- A transcript matching the final edit.
- Narration describing essential visual information.
- Flashing review of the exported video.
- Verified public artifact links and resource attributions.
- Confirmation of the challenge's actual submission requirements.

Do not mark M7 complete or claim WCAG conformance until the runtime,
manual-audit, media, and submission gates have recorded evidence.