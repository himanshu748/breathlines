# Local test video (not bundled)

The official SmartSpectra checkout at `~/research/ss` was checked first: no
MP4, MOV, AVI, WebM, or Y4M assets were present.

## 45-second CC-licensed input

- **Local MP4:** `/home/ubuntu/research/breathlines-face-45s.mp4`
- **Chromium fake-camera input:** `/home/ubuntu/research/breathlines-face-45s.y4m`
- Source: **Jimmy Wales on Collective Intelligence**, interview by **Dan Gillmor,
  Center for Citizen Media**, from the Internet Archive:
  <https://archive.org/details/DanGillmor_CenterforCitizenMediaJimmyWalesonCollectiveIntelligence>
- Original download:
  <https://archive.org/download/DanGillmor_CenterforCitizenMediaJimmyWalesonCollectiveIntelligence/JimmyWales.mp4>
- License, verified in the Archive item's `metadata.licenseurl`:
  **[CC BY-NC-SA 2.5](https://creativecommons.org/licenses/by-nc-sa/2.5/)**.
  Attribution: Dan Gillmor, Center for Citizen Media, _Jimmy Wales on Collective
  Intelligence_. Changes: excerpted 00:30–01:15, audio removed, transcoded to
  H.264 MP4 and scaled Y4M. Derivatives retain CC BY-NC-SA 2.5. No endorsement
  by the interviewer or interviewee is implied.
- This is a **noncommercial local test asset only**, not MIT-licensed and not
  bundled or used in app marketing. Do not redistribute it in a commercial
  product; obtain a suitable separately licensed recording for that use.
- Stationary indoor seated interview, predominantly frontal face and even
  lighting. It includes natural speech/head motion, and is only 320×240 with
  visible compression. It is useful for exercising the file/fake-camera path,
  **not** a physiological accuracy benchmark. A keyed SmartSpectra 3.5.0 run
  with paced playback and Mesa lavapipe completed with confident pulse,
  breathing rate, expression and arterial waveform readings. Every validation
  event was code 0 (`kOk`, “Hold still and record”), not a motion warning.
  45s is too short for confidence-gated HRV.

### Numeric regression excerpt

`test/real-signals.json` contains rounded chest waveform values from the first
20 seconds and the first 100 stable pairs of derived eye-openness ratios from
that run. It contains no frames or face coordinates. Attribution and
**CC BY-NC-SA 2.5** terms above apply to this derived fixture, separately from
the application's MIT license. SDK detection counts are regression baselines,
not independently annotated physiological ground truth; no thresholds were
tuned to this interview clip.

Reproduce outside the repository:

```sh
curl -L --fail -o ~/research/jimmy-wales-interview.mp4 \
  'https://archive.org/download/DanGillmor_CenterforCitizenMediaJimmyWalesonCollectiveIntelligence/JimmyWales.mp4'
ffmpeg -ss 30 -i ~/research/jimmy-wales-interview.mp4 -t 45 -an \
  -c:v libx264 -crf 18 -pix_fmt yuv420p ~/research/breathlines-face-45s.mp4
ffmpeg -i ~/research/breathlines-face-45s.mp4 -an \
  -vf 'scale=640:480,fps=25' -pix_fmt yuv420p ~/research/breathlines-face-45s.y4m
```

## Additional CC BY 4.0 short sample

A much sharper, still, frontal sample (640×480, 25fps) is at:
`/home/ubuntu/research/cardio-video-source/data/sample_video.avi`.
It is **only 5 seconds**, so it cannot substitute for the 30–60s smoke input.
No looping was used to disguise its duration.

Mirror: <https://github.com/saksham2001/Balancing-Cardiac-Privacy/blob/main/data/sample_video.avi>,
commit `13b22a8a9f3dfd4a54e72b437bc92344ba879cc0`. Its README identifies the
sample as LGI-PPGI data. Original dataset:
<https://github.com/partofthestars/LGI-PPGI-DB>, **CC BY 4.0**.
Attribution: C.S. Pilz, S. Zaunseder, J. Krajewski, V. Blazek,
_Local Group Invariance for Heart Rate Estimation from Face Videos in the Wild_,
CVPR Workshops, 2018, pp.1254–1262.
License: <https://creativecommons.org/licenses/by/4.0/>. Unmodified source.
The original dataset's README currently reports its full-session downloads
unavailable. No sample video is committed to this app repository.
