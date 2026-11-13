# ORBIT-LENS — NASA, Space Apps and Data-Use Policies

**Team:** Schwarzschildren  
**Version:** 0.1.0 · **Reviewed:** 12 November 2026  
**Status:** Pre-development project policy; not an official NASA policy document.

ORBIT-LENS is a proposed browser-based temporal exploration platform for SPHEREx observations. This document establishes the team's obligations, evidence requirements and release gates. It distinguishes published external requirements from safeguards adopted by the team. It does not certify eligibility, NASA approval or legal compliance.

Companion documents: [Terms of Service](../terms-of-service/README.md), [Aesthetics Guidelines](../aesthetics-guidelines/README.md), [UI Guide](../ui-guide/README.md).

## 1. How to interpret this document

- **External requirement:** an obligation described in a linked authoritative source. The source governs if this summary differs.
- **Team requirement — MUST:** a release condition adopted by ORBIT-LENS.
- **Recommendation — SHOULD:** the preferred approach; document reasons for exceptions.
- **Unverified:** not established by the sources checked; do not advertise it as fact.

NASA rules, competition participation terms, archive instructions and ORBIT-LENS product policies serve different purposes. Participation does not authorize unrestricted NASA branding. A software license does not automatically cover scientific data, photographs, third-party code or trademarks.

## 2. Verified status and corrections to the project plan

### Competition calendar

The official 2026 event page announces **14–15 November 2026**. It lists project submission from November 14 at 09:00 to November 15 at 23:59 local time and teams of at most six participants. Confirm the registered event's timezone and instructions before turning these into team deadlines. The plan's November 13–14 schedule must not be published as the global calendar. [Official 2026 event page](https://www.spaceappschallenge.org/2026/).

The participant terms allow a different day in the same week only when expressly approved in writing by the global organizers. Retain evidence of any applicable local exception. [Participant terms](https://www.spaceappschallenge.org/legal/).

### Challenge and preparation status

“Planet X and SPHEREx” is the challenge identified by the supplied team plan. The [official challenge URL](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/) could not be retrieved during this review. Its full requirements, target list, resource-release date and judging-specific instructions therefore remain pending direct verification.

The plan's claim that challenge data arrive on November 13 is **not a verified archive embargo**. Public SPHEREx data already exist. Do not wait for a presumed release to research archive capabilities.

This documentation is pre-event preparation and must retain its actual creation date. Before including it or any prebuilt application work in a competition submission, check the current official preparation/reuse rules and obtain organizer clarification where necessary. This review could not retrieve the official FAQ; it does not establish that pre-event project implementation is permitted. Maintain a record separating preparation, reused assets and work completed during the event. Do not rewrite commit history to disguise prior work.

### Archive status

The archive documentation states that QR3 distribution began in September 2026, QR2 remains documented, and QR1 was retired in February 2026. A documented release does not prove that a chosen coordinate has multiple compatible visits. Verify coverage through actual queries. [SPHEREx Data Products](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).

The access guide documents SIA v2 and on-premises spectral-image cutouts. The team's TAP-first proposal is an implementation hypothesis, not an archive requirement; inspect live service capabilities before selecting the adapter. [SPHEREx Data Access](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/).

## 3. Competition obligations

The August 7, 2026 participant terms require original contributions to be unrestricted or OSI-open-source licensed; absent a specified license, NASA distributes original content under Apache 2.0. Third-party materials require documented rights and licenses. Cite every resource. Participants must meet registration and eligibility rules; minors require guardian arrangements. Submissions exclude prohibited content, sensitive personal information and recognizable minors. Adult appearances require the relevant consent. Submission also carries publicity and video-use permissions. Read the full terms before submission. [2026 participant terms](https://www.spaceappschallenge.org/legal/).

**Team implementation requirements:**

1. Choose and commit an explicit license after contributors confirm their rights. Apache-2.0 is a proposed choice, not a license already granted by these READMEs.
2. Create a resource register covering code, libraries, datasets, fonts, icons, images, tutorials and AI-assisted work.
3. Record each resource's author/provider, version, original URL, applicable license or usage conditions, required attribution, modifications and where it appears.
4. Identify generated code or imagery and the tools used. Human reviewers remain responsible for correctness and rights. Do not claim a specific competition AI rule without checking it.
5. Make repository and demo URLs accessible to judges; test them in a signed-out browser.
6. Record actual team roles and contributions. Do not invent affiliations, mentors, awards or validation results.

A resource-register entry should use this structure:

```yaml
resource: descriptive name
provider: original author or institution
source_url: canonical source page
version_or_release: exact version, or explicitly unknown
used_in: files, page, dataset, or presentation
rights_basis: verified license or usage terms
credit_text: required attribution, if any
modified: true or false
reviewed_on: YYYY-MM-DD
reviewed_by: team member
```

## 4. NASA identity and media

NASA insignia, logotype and mission identifiers are protected; they must not become ORBIT-LENS's own identity. Consult NASA's external-use guidance before using an official identifier. [NASA Brand Guidelines](https://www.nasa.gov/nasa-brand-center/brand-guidelines/).

NASA media can often be used for factual educational purposes with source acknowledgment, but third-party copyright, identifiable-person rights and endorsement restrictions still matter. NASA hosting an asset does not establish unrestricted reuse rights. Inspect the individual credit and usage conditions. [NASA Images and Media Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

**ORBIT-LENS implementation:**

- Use an original wordmark and favicon; use text attribution by default.
- Never describe the project as NASA-operated, NASA-certified, NASA-approved or an official SPHEREx service.
- Do not mimic a government website header or combine NASA marks with the team logo.
- Keep an asset ledger and evidence of permission when permission is required.
- Label illustrations, simulated images and processed visualizations accurately.
- Preserve credits in exported screenshots and presentation slides.

Suggested project disclaimer:

> ORBIT-LENS is an independent project by Team Schwarzschildren. It uses publicly accessible astronomical resources where available and is not operated or endorsed by NASA, Caltech/IPAC or the SPHEREx mission.

Add competition participation wording only after registration and challenge selection are confirmed.

## 5. Data provenance and acknowledgments

Every displayed observation MUST carry:

- A stable observation identifier and original product reference.
- Provider, mission/survey, release and processing version where available.
- Observation time, original time scale and any documented conversion.
- Detector and available wavelength information.
- Coordinate frame, WCS availability, image units and quality-information status.
- Retrieval timestamp and processing recipe or recipe identifier.
- An explicit classification: `real`, `simulated` or `external`.

Retain distinctions between observation time, archive publication time, processing date and download time. Missing metadata is `unknown` or `unavailable`, never a guessed value.

IRSA requests archive acknowledgment plus dataset-specific citations and, where available, dataset DOIs and canonical papers. Obtain the prescribed full acknowledgment from the source when preparing research outputs; do not invent a DOI. [Acknowledging IRSA](https://irsa.ipac.caltech.edu/ack.html).

For the website, a concise original credit can read: “SPHEREx observations accessed through NASA/IPAC IRSA; processing and visualization by ORBIT-LENS.” Link the actual archive product and release. This short credit does not replace publication-specific acknowledgments.

## 6. Scientific integrity requirements

These safeguards are team policy; they are not presented as NASA certification standards.

### Honest observations

- Display only retrieved observation epochs as measured data.
- Never silently substitute simulations after an archive failure.
- Preserve source labels in thumbnails, comparisons, exports and shared views.
- Do not imply that six detectors are six interchangeable observations or that every image contains a complete 102-channel spectrum.
- Label apparent motion or variability as an observation to investigate, not a discovery.
- Explain that an empty query does not prove that an object is absent.

### Comparable images

Comparison must expose spatial registration, wavelength compatibility, units, calibration, PSF/background treatment and quality masks. A matching detector identifier alone is insufficient evidence of matching effective wavelength at the target.

The archive describes calibrated IMAGE values in MJy/sr and an unsubtracted modeled ZODI component. Its WCS-WAVE lookup is intended for visualization; science analysis uses the spectral calibration product's CWAVE and CBAND layers. Preserve these distinctions in processing and metadata. [SPHEREx Data Products](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).

Difference imaging is a later feature. Keep it unavailable until a reviewed pipeline validates alignment, wavelength response, calibration, masks, background and PSF assumptions. Record subtraction order and propagated uncertainty, including limitations from resampling correlations. A warning label alone is not an adequate substitute for compatibility checks.

Use a common display stretch when comparing compatible images. Independently auto-scaled images must carry a visible warning because they can obscure or exaggerate apparent brightness changes.

### Simulation governance

Synthetic fixtures must include their generator version, seed, parameters, units and known ground truth. Their purpose is to test rendering, coordinates and interaction; successful synthetic tests do not validate actual SPHEREx calibration. Include a persistent “Simulated data” badge and a matching export label.

## 7. Responsible archive access and security

Adopt bounded requests, caching, cancellation, backoff and explicit timeout handling. Respect documented provider limits; do not invent a supposedly official request quota. Prefer supported cutouts and avoid redundant full-image downloads.

The backend MUST validate coordinates, requested sizes and product identifiers. Resolve downloads through approved archive origins; user-supplied URLs must not become unrestricted server fetches. Enforce redirect checks, file-size limits, FITS processing limits and safe error responses. Keep credentials and private logs out of GitHub.

Treat archive labels, metadata and filenames as untrusted input when rendering HTML or creating downloads. Pin dependency versions and record the processing environment needed to reproduce exported results.

## 8. Privacy and accessibility

The MVP should work without accounts, personal uploads, precise user location or advertising trackers. Search coordinates describe sky positions, but IP addresses, logs and shared URLs may still expose usage patterns. Publish a separate, implementation-accurate privacy notice before operating a public service; the Terms document contains the required deployment decisions.

Target WCAG 2.2 AA and verify the implemented interface rather than asserting compliance in advance. Keyboard alternatives, readable metadata and motion controls are mandatory project requirements. The [UI Guide](../ui-guide/README.md) defines acceptance cases.

## 9. Release evidence and ownership

Assign a named owner to each responsibility before launch:

- **Policy/repository owner:** competition verification, rights register and license.
- **Science owner:** metadata mapping, comparison validation and limitations.
- **Design/accessibility owner:** readable provenance and accessible controls.
- **Deployment/privacy owner:** operator details, hosting behavior and contact route.

One person may hold several roles. Record names in the project repository, with consent.

### Submission gate

- [ ] Official challenge, local schedule and preparation/reuse rules checked.
- [ ] Pre-event and in-event contributions accurately recorded.
- [ ] Actual license committed; third-party resources and citations documented.
- [ ] Registration and submission requirements checked by team members.
- [ ] Claims match demonstrated functionality.
- [ ] Demo and repository work without maintainer credentials.

### Public deployment gate

- [ ] Provenance survives all views and exports.
- [ ] Real and synthetic datasets remain distinguishable.
- [ ] Compatibility checks prevent invalid scientific operations.
- [ ] Operator identity, contact details and privacy notice are complete.
- [ ] Accessibility and failure-state checks have recorded results.
- [ ] No secrets, prohibited personal data or unreviewed branded assets are published.

## 10. Review policy

Recheck the official challenge and participant terms immediately before submission; recheck archive documentation before changing releases or processing. Record date, reviewer, source change and affected feature. This document is current only to its review date and does not imply that a live archive query or scientific validation has already been performed.
