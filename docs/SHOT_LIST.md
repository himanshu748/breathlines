# Record your own 60-second Breathlines demo

A guide for Himanshu to record with his own webcam and English voice. Times are
**edited-film time**, not a promise about camera readiness or SDK warm-up.
Leave room for real measurements to arrive, then cut waiting honestly. Do not
invent readings or substitute prerecorded values. Record narration separately
if speaking moves your face/chest enough to affect sensing.

## Before recording

- Use even, front-facing light. Avoid a bright window behind you, dim light,
  moving shadows, or a flickering screen as the only light source.
- Put **your face and upper chest in frame**. Keep the camera steady, sit
  comfortably, and stay reasonably still while breathing naturally. This is not
  a breath-holding or paced-breathing exercise.
- Install dependencies with `npm install`. Supply `SMARTSPECTRA_API_KEY` through
  your terminal's environment **before starting capture**, then run `npm start`.
  Never type or echo the key on camera, put it in a command that shows its value,
  or record the key-entry screen. The app loads an environment key in memory.
  Do not commit a key or save it in the repository.
- Use your real webcam: leave `BREATHLINES_FAKE_CAMERA` unset. Confirm the
  selected camera and rotation before the take. Have the required SDK metric
  authorization and network access for authentication/model downloads.
- In **OBS Studio** or a similar recorder, capture the application window at a
  readable size, hide desktop notifications, and test your microphone levels.
  Do not capture your terminal, developer tools, or password manager. Capture
  the save dialog intentionally, checking it contains no sensitive paths.
- Keep telemetry **off**. Use an original, non-sensitive draft. Rehearse an
  approximately one-second eye closure; if landmarks are unavailable, a double
  blink is the fallback. A gesture requests stanza space; show the subsequent
  completed line so the gap is actually visible.
- Do a short signal check first. Allow pulse and breathing estimates to gain
  confidence; do not imply that HRV arrives in this short demonstration. HRV
  needs at least 60 seconds of measurement and positive confidence. Start a
  fresh consent-first take after rehearsal; account for warm-up with cuts.

## Shot list

| Time            | What's on screen                                                        | What to do                                                                                                                                                                                                                            | Suggested line                                                                                                             |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **00:00–00:06** | Consent screen; unchecked telemetry toggle                              | Start with the camera off. Pause on the privacy promises, then consent. Do not record the key screen; cut directly to the desk.                                                                                                       | “Breathlines lets breath shape your writing. Consent comes first: estimates, not medical measurements, and telemetry off.” |
| **00:06–00:14** | **Prepare camera**, preview, picker/rotation and readiness verdict      | Click Prepare camera, show your face and chest, select your webcam and correct orientation, then Check readiness. Show the actual verdict/reason. Choose full measurement if available; do not portray inconclusive as a pass.        | “Choose and rotate the camera, then check SmartSpectra three point five readiness before measuring.”                       |
| **00:14–00:21** | Live chest waveform, pulse waveform, pulse and breathing readouts       | Start full measurement. Hold on actual confidence-positive pulse and breathing values. Cut model-loading/warm-up time if needed, without altering signal playback speed or hiding a blocking error.                                   | “These are live chest, pulse, and breathing signals from my webcam.”                                                       |
| **00:21–00:35** | Writing area and living margin together                                 | Type an original phrase without Enter, such as “as the evening settles outside the window before the stars”. Keep typing naturally across an exhale; show a complete-word line and the unfinished word carried forward.               | “I type without Enter. Each exhale finds a word boundary, carrying the unfinished word forward.”                           |
| **00:35–00:42** | Current line, then a visible stanza gap                                 | Finish typing a short phrase with a space, close both eyes for about one second, then open them. Type the next phrase and let an exhale commit it to reveal stanza space. If missed, rehearse/re-record rather than faking a trigger. | “A held eye closure requests stanza space. A double blink is the fallback.”                                                |
| **00:42–00:48** | Completed lines and their waveform/metric marginalia                    | Pause over a completed line's margin. Show the available pulse, breaths, expression and talking/quiet annotations; do not describe expression as an emotional diagnosis.                                                              | “The margin keeps pulse, breaths, expression, and talking alongside each completed line.”                                  |
| **00:48–00:53** | Persistent **Stop camera**, then camera-off preview and preserved draft | Click Stop and wait for teardown. Show CAMERA OFF only once the app reports it; leave the writing visible. If native readiness is in progress, Stop must wait for its release.                                                        | “Stop releases the camera. My writing stays here.”                                                                         |
| **00:53–01:00** | Export controls and an explicit save dialog                             | Choose Export HTML or Export PNG, save to a non-sensitive path, then show the saved manuscript if time permits. Do not imply that closing the app autosaves.                                                                          | “Export HTML or PNG to save deliberately. Nothing autosaves.”                                                              |

## Finish the take

Watch it back with sound. Confirm that text is readable, line/stanza breaks keep
whole words, the intended stanza gap appears, camera-off follows teardown, and
export really writes a file. Keep narration/captions below the panel, not over
the vital readings. Remove any key, personal path, notification or private text
before publishing. Use only footage and narration you have permission to share.

The repository's [existing demo](demo.mp4) uses a separately credited Creative
Commons interview as a stand-in webcam, not Himanshu's live face. A new take
using only your own webcam and voice need not use that interview footage.
Do not remove its credit/license from any version that still includes it.
