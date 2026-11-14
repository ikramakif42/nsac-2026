# ORBIT-LENS — Test evidence and verification plan

## Evidence status

This document distinguishes supplied execution logs from verification that
still needs to be performed. No new test execution accompanies this revision.

The supplied backend summary says “9 tests,” but its terminal output ends
with `50 passed in 2.13s`. Nine is the number of documented sanity cases,
not the total backend suite count.

| Scope | Supplied evidence | Status |
| --- | --- | --- |
| Backend pytest | 50 passed in 2.13 s | Reported passing |
| Frontend Vitest | 1 file, 7 tests passed; duration 323 ms | Reported passing |
| TypeScript / production build | No current output supplied | Not verified |
| Browser accessibility automation | No output supplied | Not verified |
| Keyboard and screen-reader review | No evidence supplied | Not verified |
| Rendered contrast and flashing assessment | No evidence supplied | Not verified |
| Recorded demo and caption review | No artifact supplied | Not verified |

Do not combine these historical results into a new release certification.

## Regression commands

Run from the repository root:

    cd backend
    python -m pytest
    cd ../frontend
    npm run test -- --run
    npm run build

Record the commit, operating system, runtime versions, full commands, exit
codes, and output with the release evidence.

## Existing coverage described by supplied material

### Backend

The supplied test descriptions and terminal excerpt cover:

- Health metadata and the six-array / 102-channel model.
- Explicit synthetic search results.
- Archive gate behavior without synthetic fallback.
- Tile and cube endpoints.
- Backend WCS-TAN transformations.
- SNR computation and quality-bit decoding.
- Render-product handling of invalid pixels and constant planes.
- Rejection of incompatible reference registration, photometry, or spectra.
- No-overlap, invalid-percentile, and partial-reference errors.

A passing gate test does not demonstrate successful live archive access.
Inspect fixtures and mocks before describing a test as an integration test.

### Frontend

The supplied seven store tests describe:

- Paused initialization, 0.5 fps default, and 5-degree default field of view.
- A 3.0 Hz playback-speed cap.
- Epoch stepping with boundary clamping.
- Five benchmark target entries.
- Synthetic results across six arrays.
- Active and prefetch tile metadata.
- Time-cube metadata.

Store tests alone do not prove actual canvas timing, keyboard accessibility,
rendered source labels, or successful live network retrieval.

## Required M7 automated regression cases

Add these against the actual store and components; they are requirements,
not claims of existing coverage.

### Playback

- New sessions, URL hydration, and persisted-state hydration start paused.
- Default speed is 0.5 fps.
- Every speed mutation path enforces the 3.0 Hz ceiling.
- NaN, infinities, zero, negative, and malformed speed inputs cannot create
  an invalid timer or bypass the ceiling.
- Repeated Play actions cannot create concurrent playback loops.
- Pause, unmount, and relevant view changes cancel scheduled transitions.
- Returning from a hidden tab does not replay a backlog of transitions.
- Actual displayed epoch changes respect the timing limit.
- Wheel-event bursts are accumulated/coalesced rather than producing
  uncontrolled rapid image transitions.
- Keyboard and wheel epoch changes clamp correctly with zero, one, two,
  and many observations.

### Provenance and deep links

- SourceBadge reflects displayed data, including pending/error states.
- An archive error never changes source to synthetic.
- Late responses from an earlier request cannot replace newer results.
- Supported URL state round-trips without losing source or epoch.
- Invalid coordinates, field of view, source, and epoch are handled visibly.
- Epoch restoration waits for the relevant observation list.
- Embed mode retains source, warning context, pause, and keyboard controls.
- Backend CIDS fixtures remain consumable without client-side celestial math.

### Accessible interaction

- Every input and icon-only control has an accessible name.
- Search errors are associated with their fields.
- Dialogs have titles, appropriate focus containment, Escape dismissal,
  and focus restoration.
- Epoch selection and essential metadata are usable without a canvas.
- Reduced-motion settings suppress nonessential motion.
- Loading and error states are exposed without announcing every playback
  frame through a live region.
- Static comparison controls do not start playback.

## Manual release evidence

Follow `accessibility-audit.md`. Automated accessibility scans supplement,
but cannot replace, keyboard, screen-reader, contrast, reflow, and
flashing-risk reviews.

For each failure record:

- Reproduction URL and source.
- Commit and browser/assistive-technology versions.
- Expected and observed behavior.
- Relevant WCAG criterion.
- Severity, owner, fix, and retest evidence.

## Acceptance

M7 is not complete until required regressions pass, applicable WCAG 2.2
A/AA criteria have recorded outcomes, release-blocking defects are resolved,
and the demo video and submission artifacts have been reviewed.