# ORBIT-LENS — Aesthetics Guidelines

**Team:** Schwarzschildren  
**Version:** 0.1.0 · **Design baseline:** 12 November 2026  
**Status:** Proposed implementation specification; visual and accessibility checks remain to be performed on the website.

Companion documents: [NASA and Data-Use Policies](../nasa-policies/README.md), [Terms of Service](../terms-of-service/README.md), [UI Guide](../ui-guide/README.md).

## 1. Design purpose

ORBIT-LENS should feel like a precise, approachable astronomical instrument. The observation image and the observation timeline are the primary visual objects. Controls explain what is being viewed, how it was processed and what can be compared.

The design should support both a student's first exploration and an experienced user's inspection of metadata. Scientific credibility comes from clear provenance, restrained presentation and predictable behavior. Decorative complexity is not evidence of capability.

Core principles:

1. **Evidence stays visible.** Date, source type, release and important warnings accompany the image.
2. **One dominant task.** Searching, selecting and comparing observations receive stronger emphasis than promotional content.
3. **Meaning survives color loss.** Use text, shape and state labels alongside color.
4. **The interface stays stable.** Selecting an epoch must not move the viewer or resize controls.
5. **Enhancement is optional.** The core workflow remains usable without 3D, animation or high-end graphics hardware.

These are ORBIT-LENS design decisions, not NASA visual standards.

## 2. Brand identity and voice

Use **ORBIT-LENS** consistently in public titles and navigation. Use `orbit-lens` for filenames, package names and URL slugs where appropriate. The public tagline is **Explore the sky through time.**

Use an original text-led mark. A restrained aperture, coordinate crosshair or sequence of offset frames can support the wordmark. The mark must remain recognizable at 24 pixels and as a single-color silhouette. Do not incorporate NASA identifiers or imply official mission ownership; follow the [project branding policy](../nasa-policies/README.md#4-nasa-identity-and-media).

The voice is direct, curious and precise:

- Prefer “Search observations” to “Unlock the universe.”
- Prefer “Possible change; inspect wavelength and quality” to “New object discovered.”
- Prefer “No matching observations returned” to “Nothing exists here.”
- Prefer “Wavelength information unavailable” to an unexplained dash.
- Expand Right Ascension and Declination on first use; use RA and Dec thereafter.

Do not advertise unavailable features as implemented. Clearly mark future capabilities in documentation and omit them from active navigation unless a useful explanatory state exists.

## 3. Color system

Start with a dark scientific workspace. These proposed tokens must be measured in the actual rendered components before a contrast claim is made.

```css
:root {
  color-scheme: dark;
  --ol-bg: #0b1020;
  --ol-surface: #141d2e;
  --ol-surface-raised: #1c2940;
  --ol-border-subtle: #334155;
  --ol-control-border: #75849b;
  --ol-text: #f1f5f9;
  --ol-text-secondary: #b8c5d6;
  --ol-text-muted: #a3b1c6;
  --ol-accent: #67e8f9;
  --ol-on-accent: #08202a;
  --ol-focus: #facc15;
  --ol-success: #86efac;
  --ol-warning: #fcd34d;
  --ol-danger: #fda4af;
  --ol-external: #c4b5fd;
}
```

Use the accent for the primary action and selected interactive state. Use amber for caution; do not use a warning-colored selected button when selection itself is harmless. Use rose for failed actions and invalid fields. Green means a particular check passed, never “scientifically proven.”

The subtle border separates decorative panels. Essential input boundaries use the stronger control border or another measured treatment. Do not assume every token can be placed on every surface; opacity and compositing change contrast.

### Source badges

- **SPHEREx observation:** cyan outline, archive/database icon and explicit text.
- **Simulated data:** amber outline, flask icon and explicit text.
- **External survey:** lavender outline, layered-squares icon and survey name.
- **Source unknown:** neutral outline, question icon; never style as verified data.

A source badge describes origin, not quality. Add a separate quality indicator when warranted.

### Accessibility baseline

Target WCAG 2.2 AA: ordinary text contrast at least 4.5:1; qualifying large text 3:1; essential graphical controls and states 3:1 against adjacent colors. Do not encode required information solely by color. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## 4. Typography

Use a system sans-serif stack initially to avoid external font requests and licensing overhead. A licensed, self-hosted typeface can be introduced later after its notices are recorded.

```css
:root {
  --ol-font-ui: system-ui, -apple-system, "Segoe UI", sans-serif;
  --ol-font-data: ui-monospace, "Cascadia Code", Consolas, monospace;
  --ol-text-xs: 0.75rem;
  --ol-text-sm: 0.875rem;
  --ol-text-base: 1rem;
  --ol-text-lg: 1.25rem;
  --ol-text-xl: 1.5rem;
  --ol-text-display: clamp(2rem, 4vw, 3.5rem);
}
```

- Default body text: 16 px at the browser default, line height 1.5.
- Control labels and secondary metadata: normally 14 px or larger.
- Reserve 12 px for optional compact annotations; never essential warnings.
- Use monospace with tabular numerals for coordinates, timestamps and identifiers.
- Use sentence case in controls; avoid blocks of uppercase metadata.
- Keep explanatory prose around 65–75 characters per line.
- Use real text for labels, not text baked into screenshots or canvas textures.

Do not truncate important values without a keyboard-accessible way to inspect and copy the full value. Keep the underlying numeric precision separate from rounded display text.

## 5. Spacing, surfaces and shape

Use a 4 px base rhythm: 4, 8, 12, 16, 24, 32, 48 and 64 px. Use 16–24 px panel padding on desktop and 12–16 px on small screens. Related controls should be closer to each other than to the next task group.

Use 8 px radii for controls, 12 px for panels and pill shapes only for compact status badges. Avoid excessive nested cards. A toolbar, viewer and metadata panel should feel like one coherent workspace.

Use borders and surface contrast as the main hierarchy. Reserve shadows for floating menus and dialogs. Avoid glowing panels, glass effects over scientific imagery and animated backgrounds.

## 6. Layout hierarchy

### Landing page

Present the wordmark, purpose and primary exploration action without requiring a scroll. Add a secondary “Explore simulated demo” action with an explicit simulation label. A preview must carry the same source classification as the workspace.

Below the hero, use three concise sections: how the workflow works, data/methodology, and project/team information. Keep legal, accessibility and resource links in a consistent footer. Do not fill the page with speculative performance statistics or invented discovery counts.

### Main workspace

Desktop composition, starting at approximately 1200 px:

- Compact global header.
- Search region spanning the available content width.
- Viewer and inspector in a flexible two-column layout.
- Timeline immediately adjacent to or below the viewer.
- Comparison controls grouped with the observations they affect.

The viewer should receive roughly two-thirds to three-quarters of the main content width; the inspector should retain about 300–360 px where space permits. These are starting proportions, not reasons to force horizontal overflow.

At intermediate widths, collapse the inspector into a labeled drawer or lower section. At small widths, stack search, selected-image context, viewer, timeline and metadata. Keep source, epoch and warning context visible without opening a drawer.

Do not hide essential controls behind hover or require precision dragging. Respect device safe areas and ensure sticky controls cannot obscure focused elements.

## 7. Scientific image presentation

Use a neutral, stable surround around images. Default to a monotonic grayscale display for temporal comparison. If a color map is offered, provide a legend and an explanation of the mapped quantity. Avoid decorative rainbow maps and invented RGB “true color” labels for near-infrared products.

The rendering layer must show:

- Selected observation time and time scale.
- Source and data type.
- Detector and available spectral context.
- Display stretch and whether it is shared across comparison frames.
- Masked/invalid-pixel treatment and missing-coverage indicators.
- Orientation and angular scale only when supported by valid WCS.

NaN, masked pixels and areas outside a footprint must be visually distinct from measured zero intensity. Use a subtle neutral pattern or transparent mask with an explanatory key. Do not color invalid pixels as if they were real high-intensity sources.

Render overlays with thin, high-contrast outlines and adjustable density. Keep crosshairs hollow at the center so they do not conceal the target. Label catalogue positions with their relevant epoch when known. Separate catalogue markers from user-selected investigation markers.

Do not use image smoothing or resampling without recording the method. Screenshots must carry a compact footer with source, epoch, processing context and simulation labeling where applicable.

## 8. Timeline and temporal view

Give the selected observation a filled marker plus a text label; use an outline for unselected observations. Selection and keyboard focus must have distinct treatments. Failed frames require a failure icon and text, not disappearance.

Use either true elapsed-time spacing or explicitly labeled observation-index spacing. Do not distribute irregular observations evenly under an unlabeled continuous-time axis. When dates are close, aggregate visual tick marks while keeping every observation available in an accessible list.

The optional 3D stack is an arrangement of observed image planes. Label its axis “Observation time” or “Observation index,” as appropriate. It is not a physical distance axis or cosmological light cone. Depth and opacity are presentation controls and must not imply physical brightness or distance.

## 9. Motion and flashing

Start paused. Avoid decorative orbit animations, parallax and auto-rotating 3D scenes. Use short 120–180 ms transitions for ordinary menus and panels; remove or reduce them when the user requests reduced motion.

Do not crossfade scientific epochs in a way that implies intermediate measurements. Replace frames directly for comparison, and keep the timestamp synchronized with the displayed pixels.

Blink can be uncomfortable or unsafe for some viewers. Provide a caution, an obvious pause action and a static side-by-side alternative before starting. The initial project limit is 0.5–1 image transitions per second, subject to an actual flashing-risk assessment. This conservative rate is not an accessibility certification. Do not expose a high-speed mode until it has been evaluated. Avoid rapidly flashing status indicators entirely.

## 10. Component appearance

### Buttons and fields

Use a solid accent primary button with dark text. Secondary actions use outlined or raised-surface treatments. Destructive actions use explicit wording and a danger treatment; archive errors are not destructive actions.

Display persistent labels above fields. Place units alongside inputs and errors below them. Invalid input uses both a border treatment and an error message. Disabled controls explain why they are unavailable in adjacent text or an accessible description.

### Menus, dialogs and tooltips

Menus should align to their trigger and remain inside the viewport. Dialogs require a visible title and close action. Tooltips supplement visible labels; they must not contain the only explanation of a scientific limitation. Avoid hover-only interactions.

### Loading and notifications

Use low-motion placeholders only in the region actually loading. Prefer “Retrieving observation 2 of 6” when the count is known. Never fabricate percentage progress. Preserve the viewer's dimensions while loading.

Use persistent inline notices for incompatible data, partial retrieval and stale results. Temporary toasts are suitable for actions such as “Link copied,” not for warnings essential to interpretation.

## 11. Icons and illustrations

Use one licensed icon set with consistent stroke width and optical size. Pair unfamiliar icons with text; expose accessible names on icon-only buttons. Record the icon package and license in the resource register.

Decorative astronomical imagery should have empty alternative text when it conveys no information. Scientific previews require a concise description of source, epoch and purpose, plus nearby structured metadata. AI-generated art must not appear as a real observation or scientific result.

## 12. Accessibility and responsive review

The visual system must tolerate text enlargement and reflow. At a 320 CSS-pixel viewport, page controls and explanatory content should remain usable without page-wide horizontal scrolling. A genuinely two-dimensional scientific canvas may retain pan/zoom, but surrounding controls must reflow.

Use a visible focus ring, with offset where necessary against mixed backgrounds. Aim for 44 × 44 CSS-pixel hit areas for touch controls as a project usability target. Do not mistake this project target for a claim that every WCAG criterion has been met.

Test dark-mode rendering, browser zoom, forced colors, reduced motion and loss of color information. Native controls and semantic text should remain operable even if canvas rendering is unavailable.

## 13. Design handoff and acceptance

Deliver component states for default, hover, focus, active, disabled, loading, invalid and unavailable. Include representative mock content for zero, one, two and many observations; long identifiers; missing metadata; and mixed-quality data.

Before visual sign-off:

- [ ] Image and timeline dominate the workspace.
- [ ] Source, date and warnings remain visible at all supported widths.
- [ ] Real, simulated and external data are distinguishable without color.
- [ ] Contrast is measured on rendered components, including focus states.
- [ ] Keyboard focus remains visible beneath sticky regions.
- [ ] All scientific previews and exported examples have honest labels.
- [ ] No unsupported NASA affiliation or unreviewed official mark appears.
- [ ] Reduced-motion settings suppress unnecessary movement.
- [ ] Small-screen and enlarged-text layouts retain the complete basic workflow.
- [ ] Screenshots in the repository reflect the implemented version.

Record unresolved defects with severity and ownership. Do not claim accessibility conformance or scientific validation from these guidelines alone.
