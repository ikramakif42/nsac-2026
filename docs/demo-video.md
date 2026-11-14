# ORBIT-LENS — Demo video production script

## Artifact status

This is a recording-ready script, not a recorded video.
Target duration: approximately 2 minutes 30 seconds, subject to the actual
challenge submission limit.

Use the implemented application. Do not simulate successful archive access,
invent discoveries, or label synthetic footage as real observations.

## Recording preparation

- Record the release commit and browser.
- Start with playback paused at 0.5 fps.
- Choose an explicit synthetic dataset for a reproducible demonstration.
- Keep the `SYNTHETIC` SourceBadge visible throughout synthetic footage.
- If including real archive footage, verify its provenance and preserve
  its source label independently.
- Keep selected epoch and processing context legible.
- Hide credentials, private tabs, and local personal information.
- Disable decorative motion and notifications.
- Use static cuts rather than flashing transitions.
- Do not speed up blink footage during editing.
- Verify the recorded output for flashing risk.
- Record only features that actually work in the release.

## Storyboard and narration

### 0:00–0:15 — Purpose

Visual: Paused workspace with visible source and selected epoch.

Narration:
“ORBIT-LENS helps people explore the infrared sky through time. Comparing
observations can reveal possible motion or variability worth investigating.
A visible change is a candidate for review, not a confirmed discovery.”

### 0:15–0:40 — Provenance and epoch selection

Visual: Explicitly select the synthetic demonstration. Step between epochs
using a keyboard control, then show gentle trackpad or mousewheel scrubbing.

Narration:
“This demonstration uses synthetic data, labeled on screen. The source and
observation time stay visible as we inspect epochs. Archive failures are
reported instead of silently replacing real observations with simulation.”

### 0:40–1:00 — Controlled comparison

Visual: Show the playback caution and paused state. Start at 0.5 fps briefly,
pause, and show the verified static comparison alternative.

Narration:
“Playback starts paused at half a frame per second. Users control when it
starts and can pause immediately. Static inspection supports comparison
without animation. The playback ceiling is three image transitions per
second; that limit alone is not an accessibility certification.”

Recording gate:
If a static comparison alternative is missing, implement and verify it
before recording this segment. Do not imply that a planned feature exists.

### 1:00–1:25 — Scientific interpretation

Visual: Inspect available quality flags, SNR information, and spectral data.

Narration:
“Apparent differences can come from coverage, wavelength, or image quality.
ORBIT-LENS exposes quality information and spectral context to help users
investigate those alternatives. SPHEREx has six physical detector arrays
covering 102 spectral channels from 0.75 to 5 micrometers.”

### 1:25–1:45 — Optional spatial presentation

Visual: Open the implemented time-cube and return to the primary viewer.

Narration:
“The optional time-cube arranges observed images by time or observation
index. Its depth is a presentation axis, not physical distance.
The Python backend owns celestial transformations and scientific
calculations; the browser renders their results.”

### 1:45–2:10 — Shareable investigation

Visual: Copy a deep link and open it in a fresh tab. Confirm the same source
and requested epoch with playback paused.

Narration:
“A shared link preserves the sky position, field of view, source, and epoch.
Opening the link starts paused, so a shared investigation does not start
unexpected animation.”

### 2:10–2:30 — Closing and attribution

Visual: Stable end card with project name, team, repository URL once verified,
and independent-project disclaimer.

Narration:
“ORBIT-LENS: explore the sky through time. Created by Team Schwarzschildren
as an independent NASA Space Apps Challenge project, not an official NASA
or SPHEREx mission product.”

## Accessible media deliverables

- Final video with accurate synchronized captions.
- Plain-text transcript matching the final edit, not merely this draft.
- Narration or audio description conveying essential visual actions/results.
- Legible source labels and processing context.
- No background audio that obscures speech.
- Reviewed flashing-safe edits.

## Export and review checklist

- [ ] Challenge duration and format limits confirmed.
- [ ] Every shown feature verified on the release commit.
- [ ] No invented data, performance statistics, or discovery claims.
- [ ] Source and epoch labels readable at the submission playback size.
- [ ] Captions match final audio and do not obscure essential context.
- [ ] Visual information is understandable from narration/descriptions.
- [ ] Flashing-risk review recorded.
- [ ] Final video and transcript links tested without private credentials.
- [ ] Resource licenses and attributions recorded.