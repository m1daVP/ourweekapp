# OurWeek Shipaton and Short-Form Promo Videos — Design

**Date:** 2026-09-09  
**Status:** Approved design; awaiting written-spec review

## Goal

Produce one warm, credible Shipaton 2026 submission video and three vertical
short-form promotional videos for OurWeek.

The flagship video must explain OurWeek's purpose, demonstrate the real core
experience, show the genuine RevenueCat Premium flow, and fit safely within the
two-minute submission limit. It is designed for Grand Prize, RevenueCat Design
Award, HAMM Award, RevenueCat Peace Prize, and #BuildInPublic Award submissions.

## Audience and tone

The audience is Shipaton judges and prospective OurWeek users: couples and
families who want a calmer way to keep practical household conversations from
getting lost between weeks.

The tone is warm, practical, and grounded. The video must not frame OurWeek as
therapy, shame users for household tension, or present it as a generic
productivity app.

Narration uses a natural English AI voice. Captions are permanently rendered
into every deliverable for silent viewing.

## Source material

The video uses real captures from OurWeek with a fictional, cleanly seeded
household. No production user data, tokens, private notes, or fabricated app
screens may appear.

Captured flows:

1. Home screen and start-meeting path.
2. Check-in attendance and a reflective prompt.
3. Meeting topic, agreement, task ownership, and recap.
4. Task list, meeting history, and unresolved-item follow-up.
5. RevenueCat-backed Premium paywall and the platform purchase flow.
6. A real local reminder notification.

## Flagship video

### Format

- Runtime: 1 minute 50 seconds to 1 minute 55 seconds.
- Master: 1920×1080, 16:9, MP4/H.264, 30 fps.
- Delivery safety: all material essential to judging completes by 1:55; no
  required content relies on a viewer continuing beyond two minutes.

### Timed storyboard

| Time      | Visual                                                                           | Narrative job                                                                                  |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0:00–0:10 | A brief warm human opening leading into the real OurWeek home screen.            | State the problem: busy households need a calmer place to begin the weekly conversation.       |
| 0:10–0:35 | Start a check-in, choose participants, respond to a prompt, and add a topic.     | Establish the guided weekly ritual with no slow logo intro.                                    |
| 0:35–1:05 | Capture an agreement, assign a task, and reveal the shared recap.                | Show the central transformation from discussion to clear commitments and follow-up.            |
| 1:05–1:25 | Open tasks and history; show an unfinished item returning to the following week. | Demonstrate continuity and accountability without blame.                                       |
| 1:25–1:40 | Present the genuine Premium paywall and native RevenueCat purchase experience.   | Explain the real Premium value, current localized price, and the business model.               |
| 1:40–1:50 | Show a genuine local reminder and return to the weekly ritual.                   | Establish a thoughtful return path.                                                            |
| 1:50–1:55 | OurWeek logo/end card.                                                           | Name the entered categories: Grand Prize, Design Award, HAMM, Peace Prize, and #BuildInPublic. |

### Narration principles

- Use concise English sentences aligned to actual actions on screen.
- State benefits only when the capture visibly supports them.
- Use the live paywall price and plan terms visible in the capture; do not
  hard-code pricing into the narration or overlay.
- If post-launch metrics are available at release time, insert one verified
  Grand Prize traction statement. Do not invent downloads, revenue,
  retention, or conversion metrics.

### Award-claim guardrails

- **Grand Prize:** show only verified traction/growth evidence, if available.
- **Design Award:** use the app's real warm-minimalist interface and subtle,
  accessible motion rather than presentation-only mockups.
- **HAMM:** demonstrate the authentic RevenueCat paywall and explain the
  current Premium value proposition.
- **Peace Prize:** position the benefit carefully as supporting calmer,
  clearer household coordination; do not make therapeutic or clinical claims.
- **#BuildInPublic:** the video may name the category, but the submission also
  needs the separate public build story and social posts required by the award.
- **OneSignal / Keep Them Coming Back:** excluded from award claims until the
  application has a real OneSignal integration and a deployed campaign. The
  current video may show only a genuine local reminder.

## Short-form videos

All clips are 9:16, 1080×1920, MP4/H.264, 30 fps, 20–30 seconds. Each starts
with a spoken/captioned hook in its first two seconds and ends with an OurWeek
logo plus a simple call to action.

### 1. The same Sunday conversation

Hook: “We kept having the same conversation every Sunday.”

Story: surface a practical household tension, begin an OurWeek check-in, make
one agreement, and finish with a calmer next step.

### 2. A 15-minute ritual

Hook: “A weekly check-in that actually sticks.”

Story: compressed start-to-recap flow: prompt, topic, responsibility, summary.

### 3. Nothing important disappears

Hook: “Don’t let the important things disappear after the conversation.”

Story: show a task, history, and a carried-forward follow-up, ending on the
next weekly reminder.

## Visual and audio system

- Capture the actual app within a clean, neutral device frame.
- Preserve legibility: no fast UI actions, tiny captions, or decorative text
  over essential product content.
- Use OurWeek's sage, earth, linen, and warm-off-white palette for title cards
  and transitions.
- Use soft reframing, simple tap/cursor emphasis, and gentle zooms; avoid
  hyperactive social-video cuts.
- Pair the English AI voice with light, licensed background music that remains
  below the narration.
- Produce an `.srt` caption file alongside each burned-in video to support
  later revisions and accessibility.

## Production workflow

1. Prepare a deterministic demo household with fictional content.
2. Capture each source flow on a device/emulator in a fixed resolution.
3. Write narration to the final captured sequence; generate the AI voice.
4. Compose video, captions, audio, framing, and transitions programmatically.
5. Render masters and vertical variants.
6. Review all cuts at normal speed and muted, check the spoken claims against
   the capture, and run a final duration check.

## Acceptance criteria

- The flagship final cut is 1:55 or shorter and includes every required core
  segment before the two-minute limit.
- All displayed UI is real OurWeek UI and all product/award claims are true.
- Premium purchase is visible as a genuine RevenueCat-backed flow, not a mock.
- The local reminder is clearly labeled/represented as a local reminder unless
  OneSignal integration and campaign evidence exist.
- Captions match the final narration and remain readable on a mobile screen.
- Each vertical video has a clear first-two-second hook and a complete,
  intelligible story when viewed without sound.
- Exports play correctly as H.264 MP4 files at the required aspect ratios.

## Risks and decisions

- The flagship must use a safe demo account and stable seeded state; relying on
  live user data or an unscripted backend causes privacy and continuity risk.
- Real subscriptions must be tested in a sandbox/test environment so no
  personal payment data or unfinished purchase state appears.
- OneSignal is currently outside the promo claim scope; showing a local
  reminder does not satisfy its Shipaton award requirements.
- No final narration may cite Grand Prize traction figures without a dated,
  verifiable source.
