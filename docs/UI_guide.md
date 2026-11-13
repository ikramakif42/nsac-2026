# ORBIT-LENS — UI and Interaction Guide

**Team:** Schwarzschildren  
**Version:** 0.1.0 · **Specification date:** 12 November 2026  
**Status:** Pre-development behavior contract; not a report of completed functionality.

Companion documents: [NASA and Data-Use Policies](../nasa-policies/README.md), [Terms of Service](../terms-of-service/README.md), [Aesthetics Guidelines](../aesthetics-guidelines/README.md).

## 1. Product outcome and scope

A first-time visitor should be able to select a sky region, find available observations, inspect an epoch, compare it with another compatible observation and understand the evidence's source and limitations.

The MVP includes coordinate entry, FOV selection, a functional source adapter, image display, observation selection, previous/next navigation, controlled playback or blink, basic comparison and metadata. Synthetic fixtures can validate the workflow, but a simulation-only demo must not be described as successful real-SPHEREx integration.

Prioritize a reliable 2D viewer. Full spectral exploration, difference imaging, automated candidate detection, 3D stacks, all-sky browsing and user accounts are not prerequisites for the MVP. The eventual implementation should follow the supplied React/TypeScript frontend and Python/FastAPI scientific backend proposal unless repository constraints justify a documented change.

## 2. Information architecture

These are proposed application routes, not existing archive endpoints:

- `/` — purpose, source transparency and entry actions.
- `/explore` — search, viewer, timeline, comparison and metadata.
- `/about` — team, project scope and independent status.
- `/methodology` — data sources, processing, simulation and limitations.
- `/terms` and `/privacy` — activated operator documents.

Use a single exploration workspace with an optional 3D mode instead of creating disconnected observation states. A direct link to `/explore` must work without first visiting the landing page.

## 3. Primary workflow

1. Choose “Start exploring” or explicitly choose a simulated demonstration.
2. Enter RA, Dec and FOV, or select a verified target preset.
3. Review source and available filters.
4. Submit “Search observations.”
5. Review the result count, coverage limitations and source type.
6. Select an observation and inspect its timestamp, spectral context and quality.
7. Step through available observations or start controlled playback.
8. Choose two observations for side-by-side, blink or overlay where supported.
9. Inspect processing details and preserve provenance when sharing or exporting.

Opening the page must not trigger expensive archive downloads automatically. A share URL can populate the query immediately; show a clear load action before substantial retrieval.

## 4. Search form

### Coordinates

Provide a format selector: **Decimal degrees** or **Sexagesimal**. State that the input frame is ICRS unless a different supported frame is explicitly selected. Do not label ICRS as an observing date; reference frame, coordinate epoch and observation time are distinct.

- Decimal RA: finite value `0 <= RA < 360` degrees.
- Decimal Dec: finite value `-90 <= Dec <= 90` degrees.
- Sexagesimal RA: hours, minutes, seconds; `0 <= hours < 24`, minutes and seconds below 60.
- Sexagesimal Dec: signed degrees, arcminutes, arcseconds; absolute value at most 90 degrees, with zero subcomponents at either pole.
- Preserve the sign for inputs such as `-00:30:00`.
- Reject NaN, infinity, ambiguous unlabeled units and invalid component ranges.

For the MVP, reject RA `360` and `24:00:00` with an instruction to use `0`; do not silently wrap it. Show the parsed decimal values before search so the user can detect interpretation errors. Conversions must preserve internal precision.

Example from the supplied plan:

```text
RA  08:55:10.831  →  133.7951291667 degrees
Dec -07:14:42.53  →   -7.2451472222 degrees
```

These values are a coordinate-format example, not a verified current apparent position or guarantee of coverage for WISE 0855. High-proper-motion presets need their catalogue source and coordinate epoch recorded; any propagation to an observation epoch needs a documented astrometric method.

### Field of view

Define FOV as the requested **square angular width**, in degrees, for the initial product. Proposed presets are 0.05°, 0.1°, 0.25° and 0.5°, plus custom. These are product choices, not verified archive limits.

Apply the actual supported minimum and maximum from backend capability/configuration. Explain when an archive request geometry differs from the displayed square cutout. Show both requested coverage and actual valid footprint when they differ. Never silently reduce a requested region.

### Source, release and filters

Provide an explicit source selector with “SPHEREx archive” and “Simulated demo.” External surveys, if implemented, require their own named mode or overlay selector. Archive failure must not switch source automatically.

Populate available releases from verified adapter configuration or capabilities. Do not use an illustrative release identifier as proof of service support. Optional date, detector and spectral filters must describe their semantics and supported units. An all-detector search may return discovery results; it must not automatically create a scientifically comparable playback sequence.

For date-only filters, label the timezone/time scale and interpret the end date using a documented half-open interval ending at the following day. Keep this query convention distinct from original FITS time scales.

### Validation behavior

Validate locally for quick feedback and again on the server. Retain entered values after errors. Show an error summary linked to invalid fields and an inline explanation near each field. Focus the first invalid field after submission; do not move focus on every keystroke.

## 5. Result states and request lifecycle

Use explicit states: `idle`, `validating`, `searching`, `empty`, `results`, `partial`, `error`, `cancelled`.

- **Idle:** show guidance and an optional labeled simulation entry point.
- **Searching:** show an indeterminate indicator or genuine stage progress; provide cancel.
- **Empty:** state the query and suggest adjusting filters or FOV; do not claim physical absence.
- **One result:** display it; disable temporal comparison with an explanation.
- **Multiple results:** sort by valid observation time, with a stable tie-breaker.
- **Partial:** show successful and failed counts; retain warnings and retry choices.
- **Error:** distinguish connectivity, rate limits, unsupported products and malformed metadata.
- **Cancelled:** preserve user input and clearly stop work where cancellation is supported.

Assign a request identifier. Ignore late responses from superseded searches so old images cannot overwrite a new target. Cancel obsolete work where possible. If old results remain visible while a new search runs, label them as belonging to the prior query and disable ambiguous export actions.

Deduplicate by product identity and version according to the adapter contract. Products from the same exposure or multiple detectors do not automatically represent different temporal epochs. Report both product count and distinct observation-time count when useful.

Exclude observations with unknown time from chronological playback; keep them in a separate inspectable group. Never replace missing times with retrieval dates.

## 6. Main viewer

The 2D viewer contains the scientific image, orientation/scale where validated, pan/zoom controls, reset view, source badge and selected-observation context. Keep a text metadata representation outside the graphical canvas.

On selecting a frame:

1. Pause playback if necessary.
2. Show loading against the selected product.
3. Render pixels and their associated metadata atomically.
4. Announce completion without reading every field automatically.

Never update the timestamp before the corresponding pixels arrive. If the old image stays visible, retain its old label and mark the new selection as loading.

Preserve viewport position between aligned frames. If WCS or registration is unavailable, show “Spatial registration unavailable” and disable synchronized scientific overlays. A plain image preview may remain available with the limitation visible.

Coordinate readout must use WCS, not linear interpolation between screen edges. Handle RA wraparound and distortions correctly. Offer a keyboard-accessible “Inspect position” action; pointer hover must not be the sole route to values.

## 7. Timeline and playback

The timeline represents retrieved observations, not continuous mission coverage. Show selected timestamp, index and sequence size. For repeated timestamps, include detector or product ID to disambiguate frames.

Default to **observation-index spacing**, explicitly labeled. Offer elapsed-time spacing only if implemented correctly. Display the elapsed interval between selected observations. Do not fabricate missing observations merely because the gaps are large.

Controls:

- Previous and next observation.
- Play/pause with an accessible stateful name.
- A visible speed selector expressed as image transitions per second.
- A selectable observation list as an alternative to dragging.
- Optional first/last actions.

Start paused, do not loop by default, and stop at the last available frame. Pause when the document becomes hidden or the user changes source, query or sequence filters. A jump-to-date action selects the nearest actual epoch and says that it did so; it does not invent a frame at the entered time.

Initial playback settings should be 0.5 and 1 image transitions per second, with 0.5 as default. Follow the motion review in the [Aesthetics Guidelines](../aesthetics-guidelines/README.md#9-motion-and-flashing). Offer static inspection to users who avoid animation. Reduced-motion preference must never be overridden by autoplay.

If a frame fails during playback, pause and show retry/skip actions. If the user chooses to skip, keep the skipped product and reason in the sequence summary and exports.

## 8. Comparison behavior

Selecting two observations creates explicit **A** and **B** slots, each with source, time, detector, spectral context and quality status. Swapping slots updates all labels and any derived operation's sign convention.

### Compatibility gate

The backend should return a structured assessment with a status such as `compatible`, `warning`, `incompatible` or `unknown`, plus reasons and supported modes. The frontend must not infer compatibility from filenames or matching detector names.

Assess common footprint, WCS, effective wavelength at the target, units, release/calibration differences, masking, PSF and background treatment as relevant to the operation. Pair-specific checks should record the methods used and known uncertainties.

### Side-by-side

Allow contextual inspection of unlike images with visible incompatibility notices. Synchronized pan/zoom requires validated coordinate mapping. Each pane keeps its own labels. Independent image stretch must be visibly indicated; shared stretch is the default when scientifically appropriate.

### Blink

Use registered frames on a common displayed grid. Require explicit start, provide an obvious stop action and retain A/B identity while alternating. Warn about mismatched spectral or photometric properties; do not enable a “motion comparison” workflow when spatial registration is unknown.

### Overlay

Require valid spatial registration. Provide a labeled opacity slider and numeric value, defaulting to 50%. Keep A/B legends visible. Opacity is a display setting, not a flux-weighting or science measurement control.

### Difference — later feature

Hide or disable until the processing pipeline is validated. A disabled control must explain the missing requirement. A future enabled mode must specify subtraction order, common grid, wavelength/calibration handling, masks, background, PSF matching and uncertainty limitations. Use a diverging display scale centered on zero. Never silently fall back from failed difference processing to an ordinary image.

## 9. Metadata and quality inspector

Group metadata into Observation, Spectral context, Coordinates, Quality, Processing and Provenance. Show unknown values explicitly. Make identifiers and source links copyable.

Include where available:

- Observation ID, original timestamp, original time scale and converted display time.
- Provider, release, processing version and source product URL.
- Detector, wavelength at the inspected position and bandwidth, with units.
- Coordinate frame, spatial projection, pixel scale and cutout dimensions.
- Image units, mask availability, decoded flag definitions and uncertainty availability.
- Resampling, background treatment, display stretch and normalization bounds.
- Retrieval time, application version and processing recipe.

A green quality icon can only mean that a defined check passed. Keep “not assessed,” “metadata unavailable,” “flagged” and “passed selected checks” separate. Let users inspect raw flag values alongside release-specific interpretations. Hiding masked pixels must not erase the count or presence of masked regions.

Numerical readouts must distinguish display intensity from calibrated scientific values. Do not present screen RGB values as flux or a local contrast adjustment as photometric calibration.

## 10. Shared views and exports

Proposed share-state fields include a schema version, source, release, RA/Dec in degrees, FOV, filters, A/B product identifiers, selected mode and display settings. Use URL encoding and stable product identifiers. Validate all incoming values and bound lengths. Do not accept arbitrary backend download URLs from shared state.

Opening a shared view must state when a release or product is unavailable; never replace it silently with a different release. Restoring a link cannot guarantee identical archive contents. A reproducibility manifest should record actual products and processing, rather than relying on the URL alone.

If export is implemented, provide a view image and a machine-readable manifest. The image carries source type, observation time, data credit and relevant warnings. The manifest preserves query geometry, observation IDs, source references, processing version, display recipe, compatibility assessment and simulation generator details where relevant. Include file hashes when computed; never populate them with placeholders presented as real values.

UI export controls should state whether they produce a rendered preview, a manifest or a source FITS download. Do not describe a PNG as a calibrated FITS product.

## 11. Keyboard and assistive technology

Use semantic form controls, headings, landmarks and buttons. Provide a skip link to the exploration workspace. Timeline selections must have readable labels containing observation identity and time. Menus, dialogs and drawers must manage focus predictably and return it to their triggers.

Recommended scoped shortcuts:

- Left/right arrows: previous/next when the timeline control has focus.
- Home/End: first/last when the timeline control has focus.
- Space: activate the focused playback button using native button behavior.
- Escape: close a transient dialog or menu; provide a separate visible pause control.

Do not override text-entry shortcuts or capture arrows globally. A canvas must have keyboard alternatives for pan, zoom and reset. Provide an observation list and selected-position text so the image is not the only representation of useful information.

Use polite status announcements for search completion and selection. Use assertive announcements sparingly for blocking failures. During playback, avoid announcing every frame; announce playback start, stop and the final selected epoch.

WCAG 2.2 includes keyboard access, reflow, visible/unobscured focus, non-drag alternatives, status messages and target-size requirements. Audit the implemented workflow against the full AA standard; a checklist or automated score alone does not establish conformance. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## 12. Performance and resilience

These are proposed engineering targets, not measured performance claims:

- Acknowledge local control interactions within approximately 100 ms where feasible.
- Display a search/loading state immediately while the archive works.
- Load only the selected image and a small bounded prefetch window.
- Keep large FITS processing off the browser's main UI thread.
- Lazy-load optional 3D code and cap GPU texture memory.
- Cache by product/version and processing parameters to prevent stale mixed outputs.

Record benchmark conditions before claiming speed: browser, device, network, image dimensions, cold/warm cache and archive response time. Separate archive latency from local rendering latency.

If WebGL is unavailable or a context is lost, retain the 2D workflow or a static preview and metadata alternative. Offline demonstrations may use explicitly cached real data with retrieval dates or labeled simulations. Do not imply that an offline cache is live archive access.

## 13. Suggested component and state boundaries

Suggested components are `CoordinateForm`, `SourceSelector`, `ObservationList`, `SkyViewer`, `TimelineControls`, `ComparisonPanel`, `MetadataInspector`, `StatusNotice` and `ExportDialog`.

Keep query draft, committed query, request status, retrieved products, selected product IDs, viewport, comparison settings and display settings separate. Components should read a shared observation model rather than maintaining conflicting copies of scientific metadata.

The backend owns parsing of scientific products, coordinate transforms, normalization provenance and operation eligibility. The frontend owns interaction and presentation. Both validate inputs. A successful HTTP request does not by itself mean the dataset is scientifically usable.

## 14. Acceptance scenarios

Record each case as not run, passed, failed or blocked, with a build identifier and evidence. These cases are requirements, not completed tests.

### Input and discovery

- Valid decimal and sexagesimal inputs resolve to the same coordinate within specified precision.
- Negative-zero declination, pole values and RA wrap boundaries behave as documented.
- Invalid ranges and malformed units produce understandable inline errors.
- FOV outside actual backend limits is rejected without silent clipping.
- Zero and one-result searches produce useful states without active comparison controls.
- A late response from an old query cannot replace the current query's results.

### Scientific presentation

- Pixel data and timestamp always refer to the same displayed product.
- Irregular dates do not appear to be continuously observed.
- Reprocessed copies and simultaneous detector products are not counted as independent epochs without justification.
- Missing time, WCS, wavelength or quality metadata is visible and constrains dependent operations.
- A differing-wavelength fixture cannot silently pass a comparison gate.
- Shared and independent stretch modes are visibly distinguishable.
- Synthetic motion, stationary-source, variable-source and bad-pixel fixtures preserve their labels and expected context.

### Interaction and accessibility

- A keyboard-only user can search, select, compare, inspect metadata and stop playback.
- Screen-reader users can access search results and selected-observation details.
- Touch users can operate controls without hover or precision dragging.
- Reduced motion, 200% text enlargement and narrow-layout reflow retain core functionality.
- Focus remains visible after drawers, dialogs and validation errors.
- Blink/playback begins only through explicit action and stops reliably.

### Reliability and reproducibility

- Archive failure never silently substitutes synthetic data.
- Partial retrieval preserves failed-product context.
- Cancel, retry, rate-limit and malformed-FITS states are distinguishable.
- Shared views validate input and report unavailable products honestly.
- Exports preserve source type, dates, processing and warnings.
- At least one real-data workflow is demonstrated before claiming live SPHEREx integration.

## 15. Demo and handoff

Prepare a short end-to-end demonstration: choose a verified target, show coordinates and FOV, retrieve observations, inspect dates, step through frames, compare a compatible pair, inspect quality and explain a limitation. Use one complete reliable path before demonstrating optional visual effects.

If repeated SPHEREx observations are unavailable for the selected target, say so and deliberately switch to a labeled fixture. Keep the integration limitation explicit in the project submission.

Handoff includes this specification, the chosen design tokens, implemented-state screenshots, a list of supported sources/releases, known limitations and acceptance results. The project is ready for implementation when the team understands these behaviors; it is ready for public demonstration only when the relevant behaviors have been verified in the actual build.
