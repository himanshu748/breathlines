# Demo narration

English narration for the 62-second [demo](demo.mp4), with matching
[captions](demo.srt). The opening consent shot is held longer and an equivalent
amount of setup/warm-up time is removed; the live signals are not synthesized.

| Time            | Beat                      | Spoken script                                                                                                              |
| --------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 00:00–00:05     | Introduction              | Breathlines is a writing desk. Your breath sets the line breaks.                                                           |
| 00:05–00:10     | Consent                   | Consent first: camera estimates, not medical measurements. Telemetry stays off.                                            |
| 00:10–00:19.4   | Preparation and readiness | Pick and rotate your camera, then run SmartSpectra three point five device readiness. This test camera is inconclusive.    |
| 00:19.4–00:28.5 | Input disclosure          | The face is a Creative Commons interview clip, used as a stand-in webcam. SmartSpectra processes its signals in real time. |
| 00:28.5–00:37   | Writing                   | Type without Enter. Each exhale ends a line at a word boundary, carrying unfinished words forward.                         |
| 00:37–00:43     | Live panel                | The live panel shows the chest waveform, pulse, and breathing rate.                                                        |
| 00:43–00:48     | Stanzas                   | A double blink or long eye closure can request a new stanza.                                                               |
| 00:48–00:52     | Marginalia                | The margin records pulse, breaths, expression, and talking.                                                                |
| 00:52–00:56     | Stop                      | Click Stop. Camera off, writing preserved.                                                                                 |
| 00:56–01:02     | Export                    | Export to HTML or PNG when you're ready to save.                                                                           |

## Voice and licenses

- Synthesized locally with **Piper TTS 1.8.0**, using the neural US English
  female **`en_US-ljspeech-high`** voice. No music and no recorded human narration.
  Piper uses eSpeak NG for phonemization, but the speech waveform comes from the
  neural voice model, not an eSpeak speech-synthesis fallback.
- [Voice model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD):
  trained from scratch on the **public-domain LJ Speech dataset**.
  [Dataset rights statement](https://keithito.com/LJ-Speech-Dataset/).
  The [voice repository](https://huggingface.co/rhasspy/piper-voices) declares
  **MIT** licensing; the individual model card identifies its dataset as public domain.
- [Piper engine](https://github.com/OHF-Voice/piper1-gpl): GPL-3.0;
  the engine/model are not bundled in this repository. The engine license is
  distinct from the source voice recordings and this rendered media.
- Face footage attribution and the demo's **CC BY-NC-SA 2.5** license remain in
  the [README](../README.md#submission-and-demo) and [TEST_VIDEO.md](../TEST_VIDEO.md).
  The synthetic narration is a presentation aid, not a feature of the app.

## Production notes

Each beat is synthesized separately and fitted to its time window with
pitch-preserving tempo adjustment where needed. Matching SRT captions are
burned into a dedicated lower band below the recording, not over live readings.
The final audio is AAC, normalized toward **−16 LUFS** with a **−1.5 dBTP** ceiling.
The animated WebP remains unchanged.
