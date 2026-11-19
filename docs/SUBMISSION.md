---
title: 'Breathlines: a writing desk where your breath writes the line breaks'
published: false
tags: devchallenge, presagechallenge
---

_This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04)_

## What I Built

Breathlines is an Electron writing desk for poems and journals. You supply every word; your natural exhale supplies the line breaks. There is no generated prose, breathing target, score, or instruction to become calmer. The invitation is simply to write and notice the shape that emerges.

Enter deliberately does not insert a line break. When the chest waveform reaches an exhale trough and begins rising, the app commits the line at its last whitespace and carries the unfinished word forward. If there is no whitespace yet, it briefly waits for a space rather than slicing the word. A sustained eye closure can request stanza space, with double-blink detection as a fallback when landmarks are unavailable.

The result is a manuscript with a small living margin: available pulse, breathing rate, expression and talking/quiet observations captured when each line finishes. This is creative punctuation, not a physiological assessment. The distinctive interaction is composing your own text with breath as the typesetter, rather than using breath to follow a coach or generate generic artwork.

## Demo

[Watch the demo](./demo.mp4) · [Animated preview](./demo.webp)

<!-- Before publishing on DEV, upload the video to a public host and replace this comment with its video embed. -->

The recording uses a disclosed prerecorded face clip as Chromium's fake camera, processed by the real SmartSpectra SDK—not simulated metric values. Native camera readiness is inconclusive for that input. The clip demonstrates the interaction, not measurement accuracy or a live participant session.

The demo is shared under CC BY-NC-SA 2.5. Face footage: Dan Gillmor / Center for Citizen Media, _Jimmy Wales on Collective Intelligence_, excerpted, muted and transcoded; see [source and license](../TEST_VIDEO.md). Non-commercial use only; adaptations must retain the same license. No endorsement is implied.

## Code

Repository: <https://github.com/himanshu748/breathlines>. The [README](../README.md) includes setup, platform requirements, tests, privacy details and a real-SDK file smoke runner.

Use Node 20+ and a supported desktop OS, clone the repository, then run `npm install` and `npm start`. A Presage developer key with the required metric access is needed for measurement. Supply `SMARTSPECTRA_API_KEY` in your environment or enter it in the app; never commit it. Linux also needs Electron's desktop dependencies and, for some optional models, a working Vulkan driver. Mesa lavapipe worked on the development VM.

After consent, enter the desk, click **Prepare camera**, select a camera and rotation, review readiness, and choose full or breathing-only measurement. Write without Enter. **Stop camera** ends sensing without discarding the draft; explicitly export HTML or PNG to keep it.

## How It Responds to Human Signals

Breathlines uses `@smartspectra/node-sdk` **3.5.0**, an isolated Electron preload bridge, and decoded SDK metric packets. Its exhale detector smooths the chest trace, uses hysteresis and a refractory interval, and confirms a trough on the rising edge. An abdomen trace can substitute when chest samples stop arriving. These are application heuristics, not independently validated breath annotations.

Pulse warms the ink and appears in marginalia; breathing rate and confidence-gated expression labels fill the margin. Stable talking detections are labeled as such, since that SDK field has no numeric confidence. The arterial-pressure trace supplies a waveform, never a blood-pressure diagnosis. Landmark eye geometry supports the sustained-closure stanza gesture.

The **3.5.0** integrations include `checkDeviceReadiness()`, supplied-stream frame transforms, and specific sustained-low-frame-rate recovery guidance. **3.4** camera-selection and caller-supplied-input capabilities underpin the permission-first browser camera picker and `useMediaStream()`. Readiness offers full or breathing-only mode and explains inconclusive results instead of inventing a pass.

Limits matter: HRV needs **60 seconds or more**, plus positive confidence; not every clip yields every metric. Fake-camera readiness is inconclusive because browser and native devices cannot be reliably matched. Lighting, framing, motion, camera quality and model authorization affect results. The app makes no medical claims and must not inform diagnosis, treatment or medical decisions.

## Prize Categories

**Most Creative or Delightful Use.** The inspiration is the pause between phrases: making lineation an embodied choice without asking the writer to operate another control. The playful surprise is seeing ordinary uninterrupted typing settle into breath-shaped verse. This entry focuses on creative writing, not clinical benefit; originality is an interaction claim, not a guarantee that nobody has explored related ideas.

## Consent and Data Handling

Camera consent precedes preparation; consenting alone does not open the camera. Microphone access is not requested. The preview and persistent Stop control make capture visible. If native readiness is already running, Stop waits for its teardown before claiming the camera is off because the SDK exposes no public readiness-abort API.

**Storage and retention:** the app keeps the API key, draft and session readings in memory, with no automatic manuscript or camera recording. Closing the window discards that application state. SDK model downloads may be cached separately. **Sharing:** the app has no manuscript-upload service; SDK licensing, authentication and model downloads still require network access. Explicit exports contain the writing and selected marginalia, so share those deliberately.

**Deletion:** delete exported files yourself; closing the app clears the in-memory draft, not files already saved or shared. **Telemetry:** SDK telemetry defaults off and is opt-in on the consent screen. If enabled, SDK diagnostics can include identifying/platform context; it is not described as anonymous. Consult the linked SDK privacy disclosure in the README for vendor handling.

**AI use:** Breathlines was built with Devin, an AI coding agent. The app itself runs no generative AI and sends no writing to a generative-AI service. SmartSpectra's signal-estimation models are distinct from text generation.

Stanza gestures have a separate limitation: unlike exhale breaks, they commit the current draft immediately and can interrupt a word. The demo is edited to shorten setup and later writing; it does not synthesize signals.

## Agent Session

Built with Devin. No public agent-session transcript is included; any future transcript must be reviewed for secrets and sensitive information before publication.
