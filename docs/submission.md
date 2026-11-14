# ORBIT-LENS — Submission preparation

Status: Draft copy prepared. Final URLs, recorded video, and release evidence
must be supplied before submission.

## Project title

ORBIT-LENS

## Tagline

Explore the sky through time.

## Short description

ORBIT-LENS is an interactive infrared time-series viewer for investigating
moving objects and variable stars. It combines epoch comparison, visible
data provenance, quality inspection, and spectral context while keeping
astronomical calculations in a Python backend.

## Project explanation

A change between astronomical images can be interesting, but it can also
reflect different wavelengths, coverage, registration, or data quality.
ORBIT-LENS helps users inspect those possibilities together.

The primary workspace supports temporal comparison, quality inspection,
and spectral exploration. Optional 3D views arrange observation planes for
inspection without treating display depth as physical distance.

The scientific architecture separates rendering from calculation. Astropy
and NumPy own WCS-TAN transformations, Level 2 FITS parsing, and SNR
computation. A CIDS contract carries backend results to the frontend.

SPHEREx contains six physical detector arrays spanning 102 continuous
spectral channels from 0.75 to 5.00 μm. ORBIT-LENS preserves the distinction
between detectors and spectral channels.

## Transparency and safety

Active provenance must remain visible as `SPHEREx QR3`, `SYNTHETIC`, `MAST`,
or `VizieR`. Archive errors must not trigger silent synthetic fallback.

Playback starts paused, defaults to 0.5 fps, and is capped at 3.0 Hz.
ORBIT-LENS targets WCAG 2.2 AA; conformance must not be claimed until the
application audit is complete. A playback-rate cap is not a flashing-safety
certification.

## Scientific limitations

ORBIT-LENS supports investigation, not automatic discovery confirmation.
Apparent motion or variability requires scientific follow-up.

Availability depends on archive coverage and service responses. Missing
observations are not evidence that no object exists. Synthetic examples
illustrate workflows and do not establish real astrophysical findings.

## Attribution

Developed by Team Schwarzschildren as an independent project for the
2026 NASA Space Apps Challenge.

Not affiliated with, sponsored by, or endorsed by NASA, JPL, or the
SPHEREx mission team.

Use only verified resource citations and licenses. Do not imply that every
supported archive was used in a particular demo.

## Final submission fields

Complete using verified public values:

- Repository URL:
- Release commit/tag:
- Deployed application URL:
- Paused demonstration deep link:
- Video URL:
- Transcript URL:
- Accessibility audit/evidence URL:
- Data/resource attribution URL:
- Known limitations:
- Team/contact details authorized for publication:

## Submission release checklist

- [ ] M0–M6 remain intact.
- [ ] CIDS remains compatible.
- [ ] Backend science authority is unchanged.
- [ ] Backend pytest, frontend Vitest, and production build pass.
- [ ] Live archive claims have separate integration evidence.
- [ ] All supported deep-link parameters are verified.
- [ ] Embedded mode retains provenance and essential controls.
- [ ] Accessibility audit completed; claims match evidence.
- [ ] Demo video recorded, captioned, and reviewed.
- [ ] Screenshots reflect the actual release.
- [ ] Synthetic imagery is explicitly labeled.
- [ ] Public links work without team credentials.
- [ ] No secrets or private information are exposed.
- [ ] Resource licenses and archive acknowledgments are included.
- [ ] Current challenge requirements and submission limits are confirmed.

Submission remains blocked until required fields and release gates are
complete. This document does not assert that publication or submission has
occurred.