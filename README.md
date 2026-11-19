# Breathlines ∿

## Submission and demo

[DEV submission draft](docs/SUBMISSION.md) · [Demo video](docs/demo.mp4) ·
[Animated preview](docs/demo.webp)

The demo uses a prerecorded fake camera with real SmartSpectra processing, not
simulated readings. Typing uses no Enter; exhale-triggered breaks preserve words.
Fake-camera native readiness is inconclusive. The recording includes Stop and
an explicit HTML export.
Setup/warm-up and later writing are shortened with cuts; signals are not synthesized.
The video is silent and uses explanatory captions.

Known writing limitation: exhale breaks preserve words, but a blink/eye-closure
stanza gesture commits the current draft immediately and can interrupt a word.
This separate gesture path is not changed by the camera-recovery fix.

**Demo media license (separate from the MIT app): CC BY-NC-SA 2.5.** Face footage:
Dan Gillmor / Center for Citizen Media, _Jimmy Wales on Collective Intelligence_,
[Internet Archive source](https://archive.org/details/DanGillmor_CenterforCitizenMediaJimmyWalesonCollectiveIntelligence).
Changes: excerpt 00:30–01:15, muted, scaled/transcoded, presented within a screen
recording. `docs/demo.mp4` and `docs/demo.webp` are shared under
[CC BY-NC-SA 2.5](https://creativecommons.org/licenses/by-nc-sa/2.5/):
non-commercial use only, attribution required, adaptations under the same license.
No endorsement is implied. See [TEST_VIDEO.md](TEST_VIDEO.md) for details.

### Linux software Vulkan and smoke diagnostics

Some optional SDK models require Vulkan even on a CPU-only VM. On Ubuntu,
install `mesa-vulkan-drivers vulkan-tools` and check `vulkaninfo --summary`.
Mesa lavapipe provides a software implementation; when automatic ICD selection
fails, launch with
`VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json`.
This is slower than hardware acceleration. No SDK CPU-only constructor switch
is documented in the installed 3.5.0 declarations.

The smoke runner paces file frames at 40ms so EOF does not immediately cancel
model downloads. It reports unique sample counts, positive confidence, stable
detections and detector events, and a supervisor returns exit 1 unless a
successful summary was received. Traces, landmarks, blinking and talking do not
all expose confidence fields: stable counts are not numeric confidence.
`--fixture=/absolute/path.json` explicitly saves a small numeric waveform and
derived eye ratios only; nothing is recorded by default. See `TEST_VIDEO.md`
for the real-data fixture's separate license and limitations.

On SDK processing failure (code 8), the desk preserves finished and unfinished
writing and retries at most twice with optional model metrics removed. A named
`phasic-bp-inference` or `expressions-inference` failure disables only its
arterial-waveform or expression metric. If the SDK reports only “processing
failed”, it cannot identify the cause: recovery conservatively disables the
arterial waveform first, then expression, and labels each unavailable rather
than claiming a diagnosis. Other metrics remain requested. Authentication,
authorization and low-FPS errors are not automatically retried. Stop camera
cancels recovery; a fresh preparation requests all signals again.

**A writing desk where your breath writes the line breaks.** An Electron entry
for the DEV Presage SmartSpectra SDK Challenge. Type freely; the end of an
exhale finds the edge of your line. A long blink or double blink leaves room
for a new stanza. Your manuscript remembers a small, ephemeral living margin.

Paper, typewriter ink, and a little space to be human. No scores, targets,
diagnoses, or instructions to change your breathing.

## Start here

Requires **Node 20+**, npm, and a supported desktop OS. Linux needs glibc 2.35+
and the usual Electron desktop libraries/display. Tested here on Ubuntu with
Node 24 and glibc 2.35. Installation downloads the SDK's native platform runtime
and Electron; allow their install scripts and network access.

```sh
npm install
# Optional: otherwise paste your key in the app. Never commit it.
export SMARTSPECTRA_API_KEY='your-presage-developer-key'
npm start
```

Get a key from [Presage](https://physiology.presagetech.com/). Request access to
breathing, cardio and face metrics. **No API key is bundled.** The app is useful
as an unmeasured writing/export desk without one, but never generates simulated
vitals or pretends to detect breath without the SDK.

1. Read the camera consent screen. SDK telemetry starts **off**.
2. Continue to the API key screen. An environment key is prefilled; pasted keys
   remain in memory only (no local config, keychain, or browser storage).
3. Enter the desk, then explicitly click **Prepare camera**. Consent alone does
   not acquire the camera. Place your face and upper chest in even light.
4. Choose the camera/rotation, check readiness, and choose a measurement mode.
   Type. Exhales break at the last whitespace, carrying any unfinished word
   forward. A single-word draft waits up to 1.5 seconds for a space; if none
   arrives, that break request expires without cutting the word. Enter
   intentionally does not insert a line break; pasted newlines are
   flattened. The SDK's chest waveform provides the breaks. Finished lines are
   immutable; the current line remains editable. There is no manual/simulated
   sensor bypass.
5. **Stop camera** is always visible, including while scrolling. Words remain
   in memory. Closing the window discards them. Export HTML or PNG to save.

On this VM: `DISPLAY=:0 npm start`. If the desktop session's D-Bus environment
is missing, use its existing address, e.g.
`DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus DISPLAY=:0 npm start`.
Do not disable Electron's OS sandbox to work around setup issues.

## How each live signal becomes writing

The app requests `[...breathingMetrics, ...cardioMetrics, ...faceMetrics]`
from **`@smartspectra/node-sdk` 3.5.0**. Main binds `bindSmartSpectraIpc`;
the isolated preload requires the official SDK preload; esbuild bundles the
renderer-safe SDK and `decodeMetrics` from `/messages`. The SDK acquires the
camera stream via the browser after explicit preparation; the renderer passes it
to `useMediaStream()` before `start()` and owns stopping its tracks.
No microphone is requested or permitted.

| SDK field                                     | On the desk                                                                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `breathing.upperTrace`                        | Chest trace; exponential smoothing, relative 15% hysteresis, trough confirmed by a rising edge, 1.3s refractory interval. One break per exhale, not per frame. Confirmation introduces a small delay. |
| `breathing.lowerTrace`                        | Abdomen trace; used when no new chest samples arrive for 1.5s. Switching source resets the detector to avoid a false break.                                                                           |
| `face.landmarks` / `face.blinking[].detected` | Stable 478-point eye geometry drives closure ≥650ms; when unavailable, two blink pulses within 1s request a stanza. No repeated break during a held closure. Camera visibility matters.               |
| `cardio.pulseRate`                            | Line ink becomes warmer with the estimated pulse; pulse is also recorded in marginalia.                                                                                                               |
| `breathing.rate`                              | Breaths/min in the live readout and the line's margin.                                                                                                                                                |
| `cardio.hrv[].rmssd`                          | Shown only after 60s of the current session **and** confidence >0. A longer recording is needed to test HRV.                                                                                          |
| `face.expression[].scores`                    | Highest-confidence expression label at line completion; never interpreted as a psychological diagnosis.                                                                                               |
| `face.talking`                                | Stable talking/quiet indicator. **This SDK field has no numeric confidence**, so it is explicitly labeled “stable SDK detection,” not assigned a made-up percentage.                                  |
| `cardio.arterialPressureTrace`                | Live pulse waveform only; no blood pressure values or medical interpretation.                                                                                                                         |
| `validationStatus` / `processingStatus`       | SDK hint text (light, framing, etc.) and session state shown beside the preview.                                                                                                                      |

Numeric estimates and expression scores require confidence **>0**. SDK
confidence percentages (0–100) are normalized internally, never interpreted as
accuracy guarantees. Raw chest/abdomen waveforms do not have confidence fields.
Empty and zero-confidence estimates show “—”, not zero. Readouts expire after
10s without an updated field, and each finished line gets a snapshot of the
then-current, non-expired estimates and a bounded breathing sparkline. Breathing
and blink timestamps are deduplicated; gaps reset detectors.

A `kMetricNotAuthorized` error is disclosed, and **Retry with breathing only**
starts a fresh session without cardio/face requests. Those estimates and blink
gestures are then unavailable, not fabricated. If even breathing is unauthorized,
the error remains actionable; use a suitable key. Other failures stop the camera
and keep the writing. Native session authentication and metric authorization
must still be verified with a real key.

## Consent & data handling

- **No covert monitoring.** No camera request on launch, consent, or entering
  the desk. Preview requires consent; measurement requires a key too. The OS/camera indicator and
  in-app preview make acquisition visible. Stop stops preview tracks immediately,
  revokes the permission gate, stops/destroys the SDK, and clears live estimates.
- **Local processing.** SDK camera frames and physiological estimates are
  processed on-device. Presage is contacted to authenticate the key, not to
  upload video for analysis. An internet connection/key is needed to authenticate.
- **Telemetry is opt-in here**, overriding the SDK's on-by-default behavior.
  The unchecked consent toggle passes `enableTelemetry: false`; enabling it
  allows aggregate session summaries (runtime, session shape, performance,
  validation counts/error codes, timestamps), not frames or measured vitals.
  Device-readiness checks can also send full diagnostic reports with potentially identifying
  platform context. Do not describe SDK telemetry as anonymous. See the
  [SDK telemetry & privacy disclosure](https://smartspectra.presagetech.com/docs/telemetry-and-privacy)
  and [Presage terms](https://physiology.presagetech.com/tos).
- **No application autosave, recording, database, analytics, localStorage, or
  persistent Electron session.** Key, text, bounded traces and notes are held in
  RAM. Only a user-initiated export writes manuscript content. Normal installed
  binaries, OS/browser infrastructure and OS crash/swap behavior are outside
  this application-level guarantee; this is not a secure-memory vault.
- **Exports contain personal writing and camera-derived marginalia.** Save
  and share consciously. HTML is self-contained, escaped, script-free, and has
  no external resources. PNG is locally rendered. Save-dialog cancellation writes
  nothing. The current unfinished line is included without invented estimates;
  a draft note explains this. Very large manuscripts should use HTML rather
  than PNG (30,000px PNG height guard).
- Popups, external navigation and non-camera permissions are blocked. Renderer
  Node integration is off; context isolation is on. A small custom preload
  composes the SDK's official bridge with allowlisted consent/key/export IPC;
  this custom preload requires `sandbox:false` (Electron's process OS sandbox
  is not disabled). A restrictive CSP prevents remote renderer resources.

**Not a medical device.** Camera estimates are for creative experimentation
and general information only. Not for diagnosis, treatment, monitoring a
medical condition, or making health decisions. Do not use this app to infer
someone else's physiology without their informed consent.

## SmartSpectra features used

| SDK feature                                                             | Shipped in                                                                    | Breathlines use                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device Readiness, `checkDeviceReadiness()`                              | [3.5.0](https://github.com/Presage-Security/SmartSpectra/releases/tag/v3.5.0) | Consent-gated native preflight with verdict/reason and a lighter breathing-only choice.                                                                                                             |
| `FrameTransform` on supplied input                                      | 3.5.0                                                                         | Upright, clockwise, inverted or counterclockwise camera input; preview matches processing.                                                                                                          |
| `kSustainedLowFrameRate`                                                | 3.5.0                                                                         | Preserve writing, explain the stop, offer a user-initiated breathing-only restart.                                                                                                                  |
| Explicit camera discovery/selection                                     | [3.4.0](https://github.com/Presage-Security/SmartSpectra/releases/tag/v3.4.0) | Browser picker selects the renderer stream; native preflight uses `availableCameras()` / `CameraSelection.byId()` only when camera names match uniquely. Browser/native IDs are never interchanged. |
| Motion/head-direction validation hints                                  | [3.3.0](https://github.com/Presage-Security/SmartSpectra/releases/tag/v3.3.0) | Show the SDK's live framing/lighting guidance.                                                                                                                                                      |
| Node/Electron integration                                               | [3.2.0](https://github.com/Presage-Security/SmartSpectra/releases/tag/v3.2.0) | Main/preload bridge and renderer SDK. Current `useMediaStream()` and headless `useFile()` APIs are used; their exact first-release versions are not established by those release notes.             |
| Arterial trace, HRV, expression estimates and confidence                | [3.0.0](https://github.com/Presage-Security/SmartSpectra/releases/tag/v3.0.0) | Pulse waveform, confidence-gated line marginalia, RMSSD after 60s and expression labels.                                                                                                            |
| Chest/abdomen traces, breathing rate, blinking, talking, face landmarks | Available in 3.5.0; individual introduction versions not established          | Exhale punctuation, double-blink fallback and landmark-derived eyes-closed stanzas.                                                                                                                 |

### Camera preparation and readiness

After consent, enter the desk and click **Prepare camera**. This opens only a
preview, then enumerates permission-revealed cameras. Select a chest-visible
webcam and rotation, then **Check readiness**. Measurement does not start until
you choose full signals or breathing only. A breathing-only choice checks that
configuration again before starting. Stop camera cancels preparation and stops
measurement; during native readiness it displays STOPPING CAMERA until the
probe and teardown finish. SDK 3.5.0 has no public readiness abort API, so the
desk does not claim CAMERA OFF or reopen capture before release. Unfinished
writing and finished lines are preserved.

Readiness runs in the main process with the same key, telemetry preference and
requested metrics. It temporarily releases the browser preview so native capture
can test the camera. A unique matching native camera name is required: opaque
browser IDs are not native camera IDs. Unmatched/ambiguous cameras use the SDK's
custom-input check, which is **inconclusive**, not a pass. Limited/inconclusive
results show the reason and allow an explicit attempt; blocked results do not
permit that configuration to start. Rotation applies to renderer measurement;
native readiness uses the same rotation and requested 1280×720/30fps capture settings;
the browser may negotiate a different actual resolution/frame rate.
No API key means no successful authenticated readiness or measurement.

Telemetry remains off by default. If enabled, readiness reports include device,
camera, performance and free-text diagnostics (potentially file paths), not frames
or vital signs. Nothing from the check is saved by Breathlines.

### Eyes-closed stanza geometry

The SDK's `js/messages/generated.d.ts`, `ILandmarks` (1138–1153), defines
`value: IPoint2dFloat[]`, `stable`, `reset`, and epoch-microsecond timestamps.
The [SDK Face Analysis model card](https://smartspectra.presagetech.com/docs/model-cards-and-limitations.md)
documents **478 x/y pixel coordinates** and links the
[MediaPipe numbering diagram](https://storage.googleapis.com/mediapipe-assets/documentation/mediapipe_face_landmark_fullsize.png).
Thus the layout is documented, not inferred from an unverified live recording.

The application derives eye aspect ratios from the diagram: eye contours
`33,160,158,133,153,144` and `362,385,387,263,373,380`. The sum of two lid
distances divided by twice corner distance is scale/rotation invariant. Both
eyes below 0.18 begin closure; either above 0.22 reopens (hysteresis). Continuous
stable closure for at least 650ms emits once until reopening. Reset, malformed
points or a gap over 250ms interrupts the hold; unsupported point counts are
rejected. Thresholds are application heuristics, not SDK accuracy guarantees.
When usable landmarks are absent for 1.5s, two blink-detection rising edges
100–1000ms apart provide the fallback. Blink detections are not assumed to be
continuous eyelid states. Keyed recordings are still needed to tune this gesture.

## Tests & development

`npm run format` applies Prettier (two-space indentation); `npm run format:check`
checks source and documentation without rewriting generated bundles or lockfiles.

### SDK schema verification

Checked against `@smartspectra/node-sdk` **3.5.0**, specifically
`node_modules/@smartspectra/node-sdk/js/messages/generated.d.ts`:

- `ExpressionType` (lines 352–361): UNSPECIFIED=0, ANGRY=1, CONTEMPT=2,
  DISGUST=3, FEAR=4, HAPPY=5, NEUTRAL=6, SAD=7, SURPRISE=8.
  `IExpression.scores` holds `{ type, confidence }` entries, not named fields.
- `IMeasurementWithConfidence` (233–246), `IExpressionScore` (365–372), and
  `IHrv` (580–607) specify confidence **0–100**, not 0–1. Dividing by 100 is
  intentional for internal normalized notes; the UI multiplies by 100 for `%`.
- `IHrv`: `rmssd`, `meanNn`, `sdnn`, `baevsky`, `timestamp`, `confidence`,
  `stable`. The RMSSD field and 60s application warmup are unchanged.
- `IDetectionStatus` (122–132): `detected`, `stable`, `timestamp`, **no
  confidence**. Both `IFace.blinking` and `IFace.talking` are arrays of this
  type (1262–1265). `IExpression` also exposes `stable` (468–478).
- Timestamp fields are **microseconds since Linux epoch**, represented as
  `number | Long`. Shared `timestampMs` uses `Number(timestamp) / 1000` before
  either detector; thresholds and wall-clock cache ages are in milliseconds.

No schema mismatch was found. `test/sdk-schema.test.cjs` round-trips synthetic
payloads through the SDK's actual `Metrics` encoder and `decodeMetrics`, checks
every expression enum, confidence normalization, RMSSD gating, talking shape,
and a 650ms blink using decoded epoch-microsecond timestamps. These are schema
regressions, not a substitute for keyed video processing.

### GitHub Actions

`.github/workflows/ci.yml` runs `npm ci`, `npm test`, and formatting checks on
`ubuntu-latest` with Node 22. The unit job outputs only a boolean indicating
whether the `SMARTSPECTRA_API_KEY` repository secret is available. The dependent
smoke job runs **only** when that boolean is true (fork PRs without secrets skip
it). This avoids unsupported direct secret references in a job-level `if`.
The smoke job downloads and excerpts the same attributed noncommercial test
video described in `TEST_VIDEO.md`, then invokes the real SDK smoke script.
It requires cardio/face authorization as well as breathing access; download,
authentication, missing confident readings, and processing failures fail the job.
Neither keys nor video artifacts are uploaded. Add the secret only when ready
to enable this network-dependent integration check.

```sh
npm test
npm run build
SMARTSPECTRA_API_KEY='…' npm run smoke -- /absolute/path/to/face.mp4
```

`signals.cjs` is pure JavaScript, independent of Electron and the SDK. Synthetic
`node:test` cases cover noisy periodic troughs, flat/invalid/duplicate samples,
blink timing, empty writing, stanza persistence, confidence gating, warmup, and
snapshot isolation. The smoke script uses the **real native SDK** `useFile`
pipeline, no camera/display, telemetry off, a 180s watchdog, and prints real
exhale/blink-gesture/pulse events. It exits nonzero for errors or absent confident
pulse/breathing rates. Gesture counts depend on the input: no blink is not a
smoke failure. It cannot run end-to-end until a valid API key is supplied.

### Fake camera (Electron)

```sh
ffmpeg -i /path/to/face.mp4 -an -vf 'scale=640:480,fps=25' -pix_fmt yuv420p /path/to/face.y4m
BREATHLINES_FAKE_CAMERA=/absolute/path/to/face.y4m npm start
```

This sets Chromium's `use-fake-device-for-media-stream` and
`use-file-for-fake-video-capture` switches. It still requires consent, Start,
and a real SDK key; it does not stub metrics. Recorded clips are an integration
check, not an accuracy benchmark. A mostly motionless, well-lit frontal face
with visible upper chest works best; compression and speech can reduce quality.

See [TEST_VIDEO.md](TEST_VIDEO.md) for a separately stored, legally reusable
test clip, provenance, and caveats.

## Layout

```text
main.cjs                 Electron window, camera gate, SDK IPC, export dialog
preload.cjs              Official SDK preload + narrow app bridge
renderer.js              Consent, key, desk, live SDK, charts, exports
signals.cjs               Pure detectors, confidence gating, line assembly
index.html / styles.css   Paper-and-typewriter interface (no remote assets)
scripts/smoke.cjs         Real SDK video-file smoke runner
test/signals.test.cjs     Synthetic unit tests
```

## Credits & license

Application code: **MIT**. The integration architecture adapts the official
Presage Electron quickstart's documented wiring; its source and the SDK are
**proprietary**, not MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for the checked notices and dependency terms. No Presage trademarks/assets
or video files are bundled. No remote fonts or analytics.

For public challenge submission: publish this repository once a remote is
created, supply a valid key locally, and record a consented live camera demo.
This repository does not claim that the keyless launch is a live-signal test.
