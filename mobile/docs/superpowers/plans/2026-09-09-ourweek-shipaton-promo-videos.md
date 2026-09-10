# OurWeek Shipaton Promo Videos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a 1:55-or-shorter OurWeek Shipaton demo and three 20–30 second vertical promo videos from real, deterministic app captures.

**Architecture:** Keep video production isolated in `marketing/video/` so the Vue/Capacitor product bundle does not receive Remotion or render-only dependencies. Playwright captures scripted footage from a safe demo account; Remotion composes the footage, captions, UI framing, title cards, category end card, and audio into MP4 masters. FFmpeg performs deterministic output inspection and vertical derivative encoding.

**Tech Stack:** Node.js 24, TypeScript, React, Remotion, Playwright, FFmpeg, H.264 MP4, SRT captions.

## Global Constraints

- Use only real OurWeek UI, recorded with fictional deterministic demo data.
- Never capture production accounts, tokens, private notes, payment details, or a real purchase.
- The Shipaton master is 1920×1080, 30 fps, H.264 MP4, and 1:55 or shorter.
- Each TikTok master is 1080×1920, 30 fps, H.264 MP4, and 20–30 seconds.
- Burn captions into every video and generate a matching `.srt` sidecar.
- Show the genuine RevenueCat-backed sandbox paywall; never state a hard-coded price in narration.
- Show only a local reminder until OneSignal and a campaign are genuinely implemented; do not name the OneSignal award in video claims.
- Claims about traction, revenue, retention, conversion, or social impact require a dated source captured in `marketing/video/data/proof/` before they appear in narration or captions.
- Use licensed or original music only, with narration intelligible over the final mix.
- Do not stage or commit changes unless the user later explicitly authorizes a commit.

---

## File Structure

- `marketing/video/package.json` — isolated production dependencies and render/capture/verify commands.
- `marketing/video/tsconfig.json` — strict TypeScript configuration for the video package.
- `marketing/video/remotion.config.ts` — render defaults and output-image settings.
- `marketing/video/src/index.ts` — Remotion entry point.
- `marketing/video/src/Root.tsx` — declares the flagship and vertical compositions.
- `marketing/video/src/content/schema.ts` — Zod contracts for timed clips and complete video briefs.
- `marketing/video/src/content/shipaton.ts` — 1:55 flagship brief, narration, captions, and category list.
- `marketing/video/src/content/tiktok.ts` — three vertical briefs and their first-two-second hooks.
- `marketing/video/src/components/PhoneCapture.tsx` — positions/crops real screen recordings safely.
- `marketing/video/src/components/Captions.tsx` — time-synced, high-contrast caption renderer.
- `marketing/video/src/components/EndCard.tsx` — OurWeek brand end card and category presentation.
- `marketing/video/src/compositions/ShipatonDemo.tsx` — flagship timeline.
- `marketing/video/src/compositions/TikTokPromo.tsx` — reusable vertical timeline.
- `marketing/video/src/lib/timing.ts` — seconds-to-frame calculation and clip validation.
- `marketing/video/src/lib/srt.ts` — SRT serialization.
- `marketing/video/scripts/capture.mts` — Playwright recording orchestration using a video-safe URL and explicit capture steps.
- `marketing/video/scripts/generate-narration.mts` — OpenAI Text-to-Speech narration generator that writes ignored WAV assets.
- `marketing/video/scripts/render.mts` — validates briefs, writes SRT files, and invokes Remotion render commands.
- `marketing/video/scripts/verify-output.mts` — FFprobe-based verification of codec, size, fps, duration, and required output files.
- `marketing/video/tests/content.test.ts` — validates duration, hooks, category guardrails, and SRT data.
- `marketing/video/tests/output.test.ts` — tests output metadata validation against FFprobe fixtures.
- `marketing/video/assets/captures/` — gitignored source recordings generated from safe demo data.
- `marketing/video/assets/audio/` — gitignored licensed music and generated AI narration WAV files.
- `marketing/video/out/` — gitignored MP4, SRT, and verification reports.
- `marketing/video/data/proof/README.md` — source and date requirements for any optional metrics claim.
- `marketing/video/.gitignore` — excludes capture, audio, proof evidence, render cache, and output files.

### Task 1: Create the isolated production package and content contracts

**Files:**
- Create: `marketing/video/package.json`
- Create: `marketing/video/tsconfig.json`
- Create: `marketing/video/remotion.config.ts`
- Create: `marketing/video/.gitignore`
- Create: `marketing/video/src/index.ts`
- Create: `marketing/video/src/Root.tsx`
- Create: `marketing/video/src/content/schema.ts`
- Create: `marketing/video/src/lib/timing.ts`
- Test: `marketing/video/tests/content.test.ts`

**Interfaces:**
- Produces `VideoBrief`, `TimedClip`, and `CaptionCue` types for all composition and rendering tasks.
- Produces `secondsToFrames(seconds: number, fps: number): number` and `getBriefDurationFrames(brief: VideoBrief): number` for validation and composition duration.

- [ ] **Step 1: Install only render-specific dependencies in the isolated package**

Create `marketing/video/package.json` with exact scripts and dependencies:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "capture": "tsx scripts/capture.mts",
    "test": "vitest run",
    "render": "tsx scripts/render.mts",
    "verify": "tsx scripts/verify-output.mts",
    "preview": "remotion studio src/index.ts"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "@remotion/media-utils": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "@remotion/transitions": "^4.0.0",
    "remotion": "^4.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0",
    "tsx": "^4.0.0",
    "typescript": "^6.0.0",
    "vitest": "^4.0.0"
  }
}
```

Run: `npm install` from `marketing/video`.

Expected: a package-local lockfile is created and neither `weekly-us/package.json` nor the application bundle gains a render dependency.

- [ ] **Step 2: Write the failing timing and content-boundary tests**

Create `marketing/video/tests/content.test.ts` with tests for:

```ts
import {describe, expect, it} from 'vitest';
import {getBriefDurationFrames, secondsToFrames} from '../src/lib/timing';
import {shipatonBrief} from '../src/content/shipaton';
import {tiktokBriefs} from '../src/content/tiktok';

describe('promo content boundaries', () => {
  it('converts seconds using the exact composition frame rate', () => {
    expect(secondsToFrames(1.5, 30)).toBe(45);
  });

  it('keeps the flagship at or below 1:55', () => {
    expect(getBriefDurationFrames(shipatonBrief)).toBeLessThanOrEqual(115 * 30);
  });

  it('keeps every TikTok between 20 and 30 seconds and supplies a two-second hook', () => {
    for (const brief of tiktokBriefs) {
      expect(getBriefDurationFrames(brief)).toBeGreaterThanOrEqual(20 * 30);
      expect(getBriefDurationFrames(brief)).toBeLessThanOrEqual(30 * 30);
      expect(brief.hook.endFrame).toBeLessThanOrEqual(2 * 30);
    }
  });
});
```

- [ ] **Step 3: Run the test to confirm the imports do not exist yet**

Run: `npm test -- content.test.ts` from `marketing/video`.

Expected: FAIL because `timing`, `shipaton`, and `tiktok` modules are absent.

- [ ] **Step 4: Implement strict content and timing contracts**

Create `schema.ts` so a clip cannot exceed the brief duration and every caption has non-negative ordered frame boundaries:

```ts
export type CaptionCue = {startFrame: number; endFrame: number; text: string};
export type TimedClip = {id: string; source: string; startFrame: number; endFrame: number; narration: string; captions: CaptionCue[]};
export type VideoBrief = {
  id: string;
  fps: 30;
  width: number;
  height: number;
  hook: CaptionCue;
  clips: TimedClip[];
  endCard: CaptionCue;
  categories: string[];
};
```

Implement `secondsToFrames` with `Math.round(seconds * fps)`. Implement `getBriefDurationFrames` as the highest `endFrame` across clips and end card. Root compositions must use this function for `durationInFrames`.

- [ ] **Step 5: Register empty-but-valid composition definitions**

Declare one `ShipatonDemo` composition at `1920×1080` and three TikTok compositions at `1080×1920`, all at `30` fps. Use `calculateMetadata` to read their respective brief duration rather than duplicate frame counts.

- [ ] **Step 6: Run the isolated content tests**

Run: `npm test -- content.test.ts` from `marketing/video`.

Expected: PASS once Tasks 2's content briefs exist; otherwise keep this task open until Task 2 completes.

- [ ] **Step 7: Leave changes unstaged**

Run: `git status --short` from `D:\Projects\myself\weekly-us`.

Expected: only new video-production files appear. Do not stage or commit without user authorization.

### Task 2: Encode the Shipaton script and TikTok briefs as verified content

**Files:**
- Create: `marketing/video/src/content/shipaton.ts`
- Create: `marketing/video/src/content/tiktok.ts`
- Create: `marketing/video/data/proof/README.md`
- Modify: `marketing/video/tests/content.test.ts`
- Test: `marketing/video/tests/content.test.ts`

**Interfaces:**
- Consumes `VideoBrief` and timing helpers from Task 1.
- Produces `shipatonBrief: VideoBrief` and `tiktokBriefs: readonly VideoBrief[]` consumed by Root, composition, captions, render, and SRT tasks.

- [ ] **Step 1: Extend the failing test with award guardrails**

Add these assertions:

```ts
it('lists only the approved flagship categories and never claims OneSignal', () => {
  expect(shipatonBrief.categories).toEqual([
    'Grand Prize',
    'RevenueCat Design Award',
    'HAMM Award',
    'RevenueCat Peace Prize',
    '#BuildInPublic Award',
  ]);
  expect(JSON.stringify(shipatonBrief)).not.toMatch(/OneSignal|Keep Them Coming Back/i);
});

it('uses real local-reminder wording', () => {
  expect(JSON.stringify(shipatonBrief)).toMatch(/local reminder/i);
});
```

- [ ] **Step 2: Run the content test and verify the new assertions fail**

Run: `npm test -- content.test.ts` from `marketing/video`.

Expected: FAIL until the real briefs are encoded.

- [ ] **Step 3: Implement the complete flagship brief**

Use exact timeline starts/ends in 30 fps frames:

```ts
const at = (seconds: number) => seconds * 30;
// intro: at(0)..at(10)
// guided check-in: at(10)..at(35)
// agreement, task, recap: at(35)..at(65)
// tasks, history, carry-forward: at(65)..at(85)
// genuine Premium sandbox flow: at(85)..at(100)
// local reminder: at(100)..at(110)
// end card: at(110)..at(115)
```

Write narration that matches the approved design: “Busy households don’t need another task app. They need a calmer place to begin the week.” Then explain the visible flow: choose who is here, discuss a topic, make an agreement, assign the next step, return next week, and use Premium for durable history and AI summaries. The Premium narration must say “the plan and price shown here” rather than embed a price. The local-reminder clip must say “a local reminder brings the ritual back next week.”

Use source paths such as `assets/captures/01-home.mp4`; rendering must fail when any recorded source is missing.

- [ ] **Step 4: Implement all three vertical briefs**

Set the first caption and narration to exactly these approved hooks:

```ts
'We kept having the same conversation every Sunday.'
'A weekly check-in that actually sticks.'
'Don’t let the important things disappear after the conversation.'
```

Set compositions to 25, 23, and 26 seconds respectively. Every brief ends with an OurWeek logo/end-card caption, not an unsupported pricing or OneSignal claim.

- [ ] **Step 5: Document metric-proof requirements**

Create `marketing/video/data/proof/README.md` with this exact rule: “A claim about downloads, revenue, retention, conversion, or social impact must include a dated source export or screenshot, the metric definition, its date range, and the exact on-screen/narration wording it supports.” State that unproven claims are omitted.

- [ ] **Step 6: Run the content tests**

Run: `npm test -- content.test.ts` from `marketing/video`.

Expected: PASS; flagship ≤ 115 seconds, three shorts in range, hooks appear by 2 seconds, and no OneSignal award wording exists.

- [ ] **Step 7: Leave changes unstaged**

Run: `git status --short` from `D:\Projects\myself\weekly-us`.

Expected: content briefs and tests are visible but unstaged.

### Task 3: Make capture repeatable and safe

**Files:**
- Create: `marketing/video/scripts/capture.mts`
- Create: `marketing/video/capture-plan.md`
- Create: `marketing/video/assets/captures/.gitkeep`
- Modify: `marketing/video/.gitignore`
- Test: `marketing/video/tests/capture-plan.test.ts`

**Interfaces:**
- Consumes `VIDEO_BASE_URL`, `VIDEO_DEMO_EMAIL`, and `VIDEO_DEMO_PASSWORD` only from process environment.
- Produces one MP4/WebM source file per brief clip under `assets/captures/`, never committed.

- [ ] **Step 1: Write a failing capture-plan privacy test**

Create a test that reads `capture-plan.md` and asserts it includes `fictional demo household`, `sandbox purchase`, and `local reminder`, while rejecting `production account` and `real payment method` as permitted capture inputs.

- [ ] **Step 2: Run the privacy test to verify it fails**

Run: `npm test -- capture-plan.test.ts` from `marketing/video`.

Expected: FAIL because the capture plan does not exist.

- [ ] **Step 3: Write the capture plan**

Specify these eleven recordings in `capture-plan.md`: home, attendance, prompt, topic, agreement, assigned task, AI recap, task list, history carry-forward, Premium sandbox paywall/purchase, and local reminder.

For each recording, specify the initial route/state, the exact fictional copy, target duration, no-animation pause before/after, and filename. Use a household such as “Maya & Leo” and tasks such as “Book the dentist appointment” and “Plan Saturday breakfast”; do not use personal data.

- [ ] **Step 4: Implement Playwright capture orchestration**

Use a persistent browser context with:

```ts
recordVideo: {dir: 'assets/captures/raw', size: {width: 1080, height: 1920}},
viewport: {width: 432, height: 768},
deviceScaleFactor: 2,
```

Read credentials using `process.env` and throw `Error('VIDEO_BASE_URL, VIDEO_DEMO_EMAIL, and VIDEO_DEMO_PASSWORD are required')` before opening a page if any are absent. Never print environment values. Capture each documented flow only after a semantic locator confirms the corresponding heading/button is visible. Close the context after each capture so Playwright flushes its recording.

- [ ] **Step 5: Exclude sensitive/generated capture material**

Add these exact entries to `.gitignore`:

```gitignore
assets/captures/**
!assets/captures/.gitkeep
assets/audio/**
out/**
data/proof/*
!data/proof/README.md
```

- [ ] **Step 6: Run the capture-plan test**

Run: `npm test -- capture-plan.test.ts` from `marketing/video`.

Expected: PASS.

- [ ] **Step 7: Perform a non-production capture smoke test**

Run: `VIDEO_BASE_URL=<staging-url> VIDEO_DEMO_EMAIL=<demo-email> VIDEO_DEMO_PASSWORD=<demo-password> npm run capture` from `marketing/video`.

Expected: capture files are created locally under `assets/captures/raw`; no secret appears in terminal output. Stop and resolve missing routes, unavailable staging data, or non-sandbox paywall conditions before composing video.

### Task 4: Generate and verify AI narration assets

**Files:**
- Create: `marketing/video/scripts/generate-narration.mts`
- Create: `marketing/video/tests/narration.test.ts`
- Modify: `marketing/video/package.json`
- Modify: `marketing/video/.gitignore`
- Test: `marketing/video/tests/narration.test.ts`

**Interfaces:**
- Consumes final brief narration text and the `OPENAI_API_KEY` environment variable.
- Produces one ignored 24 kHz WAV narration asset per `VideoBrief` under `assets/audio/`, named `<brief-id>-narration.wav`.

- [ ] **Step 1: Write the failing narration-contract test**

Create a test that imports `buildNarrationRequest` and asserts that it returns
`model: 'gpt-4o-mini-tts'`, `voice: 'marin'`, `response_format: 'wav'`, and an
instruction containing `warm, calm, grounded`. Also assert that flattening the
Shipaton brief narration is less than 4096 characters.

- [ ] **Step 2: Run the narration test to verify it fails**

Run: `npm test -- narration.test.ts` from `marketing/video`.

Expected: FAIL because `generate-narration.mts` is absent.

- [ ] **Step 3: Implement the OpenAI Text-to-Speech request builder**

Implement:

```ts
export const buildNarrationRequest = (input: string) => ({
  model: 'gpt-4o-mini-tts',
  voice: 'marin',
  input,
  instructions: 'Warm, calm, grounded English presentation voice. Conversational and clear, never theatrical. Use a measured pace and natural pauses.',
  response_format: 'wav',
});
```

The official speech endpoint accepts text input, a TTS model, a built-in voice,
optional instructions, and WAV output. Do not use voice cloning or submit any
real person’s voice recording. The produced assets must be identified in the
delivery README as AI-generated narration.

- [ ] **Step 4: Implement secure audio generation**

Read `OPENAI_API_KEY` only from the process environment. If it is absent,
throw `Error('OPENAI_API_KEY is required to generate narration')` before making
any request. POST `buildNarrationRequest(input)` to
`https://api.openai.com/v1/audio/speech`; check `response.ok`; write the raw
response bytes to `assets/audio/<brief-id>-narration.wav`; and never log the
API key, request authorization header, or response body.

- [ ] **Step 5: Add a package command and protect generated audio**

Add `"narrate": "tsx scripts/generate-narration.mts"` to the video package
scripts. Retain `assets/audio/**` in `.gitignore`; only an optional
`assets/audio/.gitkeep` may be committed.

- [ ] **Step 6: Run narration tests**

Run: `npm test -- narration.test.ts` from `marketing/video`.

Expected: PASS.

- [ ] **Step 7: Generate and listen to the four narration tracks**

Run: `npm run narrate` from `marketing/video` with `OPENAI_API_KEY` provided
by the user’s local environment.

Expected: four non-empty WAV files. Listen for unnatural emphasis on “OurWeek”,
“RevenueCat”, and “HAMM”; change only the narration punctuation or instructions
and regenerate until each pronunciation is clear. Do not use a generated track
until its voice and timing have been reviewed.

### Task 5: Build the real-footage compositions, captions, and SRT output

**Files:**
- Create: `marketing/video/src/components/PhoneCapture.tsx`
- Create: `marketing/video/src/components/Captions.tsx`
- Create: `marketing/video/src/components/EndCard.tsx`
- Create: `marketing/video/src/compositions/ShipatonDemo.tsx`
- Create: `marketing/video/src/compositions/TikTokPromo.tsx`
- Create: `marketing/video/src/lib/srt.ts`
- Modify: `marketing/video/src/Root.tsx`
- Test: `marketing/video/tests/srt.test.ts`

**Interfaces:**
- Consumes verified `VideoBrief` data and safe recorded assets from Tasks 2–3.
- Produces named Remotion compositions `ShipatonDemo`, `TikTokSameConversation`, `TikTokWeeklyRitual`, and `TikTokNothingDisappears`, plus `toSrt(cues: CaptionCue[]): string`.

- [ ] **Step 1: Write failing SRT tests**

Test that a cue `{startFrame: 0, endFrame: 45, text: 'A weekly check-in that actually sticks.'}` at 30 fps becomes:

```text
1
00:00:00,000 --> 00:00:01,500
A weekly check-in that actually sticks.
```

Also test that cues receive stable sequential numbers and every exported end time exceeds its start time.

- [ ] **Step 2: Run the SRT tests to verify they fail**

Run: `npm test -- srt.test.ts` from `marketing/video`.

Expected: FAIL because `toSrt` is absent.

- [ ] **Step 3: Implement `toSrt` and caption flattening**

Convert frame values at the brief FPS to `HH:MM:SS,mmm` using zero-padded integer math. Flatten clip captions in timeline order, reject overlapping cues with a descriptive error, and write one SRT file for each final video.

- [ ] **Step 4: Implement reusable visual components**

`PhoneCapture` must render recorded footage within a 16:9 or 9:16 device-safe crop, preserve screen aspect ratio, and use `objectFit: 'cover'` only after a composition-specific crop rectangle is explicitly supplied. `Captions` must render high-contrast, sentence-cased text inside a safe lower-third area with a translucent warm-off-white background and no more than two lines. `EndCard` must use OurWeek's sage `#456349`, warm-off-white `#faf9f5`, Literata-style headline treatment, and the actual small logo asset.

- [ ] **Step 5: Implement the flagship composition**

Use `Sequence` boundaries from `shipatonBrief`; layer only source footage, its matching narration WAV, captions, and mild scale/position interpolation. The final five seconds must show the category end card, and the body must never display category text for OneSignal. Render a fallback error card only in preview mode; production rendering must throw if a required capture or narration file is missing.

- [ ] **Step 6: Implement the reusable TikTok composition**

Accept `brief: VideoBrief` as the sole prop. Start its first caption at frame 0 and reserve the last 45 frames for the OurWeek end card. Keep source footage centered and captions readable without audio.

- [ ] **Step 7: Run all composition-unit tests**

Run: `npm test -- srt.test.ts content.test.ts` from `marketing/video`.

Expected: PASS.

### Task 6: Add render and output-verification automation

**Files:**
- Create: `marketing/video/scripts/render.mts`
- Create: `marketing/video/scripts/verify-output.mts`
- Create: `marketing/video/tests/output.test.ts`
- Modify: `marketing/video/package.json`
- Test: `marketing/video/tests/output.test.ts`

**Interfaces:**
- Consumes named Remotion compositions, input assets, narration WAVs, and content briefs.
- Produces four `.mp4` files, four `.srt` files, and one JSON verification report under `marketing/video/out/`.

- [ ] **Step 1: Write failing FFprobe metadata tests**

Test `validateVideoMetadata` with these fixtures:

```ts
expect(validateVideoMetadata({width: 1920, height: 1080, fps: 30, durationSeconds: 115, codec: 'h264'}, flagshipRules)).toEqual([]);
expect(validateVideoMetadata({width: 1920, height: 1080, fps: 30, durationSeconds: 116, codec: 'h264'}, flagshipRules)).toContain('duration must be <= 115 seconds');
expect(validateVideoMetadata({width: 1080, height: 1920, fps: 30, durationSeconds: 19, codec: 'h264'}, tiktokRules)).toContain('duration must be >= 20 seconds');
```

- [ ] **Step 2: Run the output tests to verify they fail**

Run: `npm test -- output.test.ts` from `marketing/video`.

Expected: FAIL because metadata validation is absent.

- [ ] **Step 3: Implement deterministic rendering**

`render.mts` must render in this fixed order: `ShipatonDemo`, `TikTokSameConversation`, `TikTokWeeklyRitual`, `TikTokNothingDisappears`. Before each render, confirm every asset source referenced by the selected brief exists. Then generate its SRT and use `renderMedia` with `codec: 'h264'`, `crf: 18`, and the composition's declared frame rate. Render filenames must be `ourweek-shipaton-2026.mp4`, `ourweek-tiktok-sunday-conversation.mp4`, `ourweek-tiktok-weekly-ritual.mp4`, and `ourweek-tiktok-nothing-disappears.mp4`.

- [ ] **Step 4: Implement FFprobe verification**

Call the locally available FFprobe executable and parse JSON output. Validate H.264 codec, width, height, FPS rounded to 30, duration, presence of a paired SRT, and non-zero file size. Write `out/verification-report.json`; return process exit code 1 if any required rule fails.

- [ ] **Step 5: Run all automated verification tests**

Run: `npm test` from `marketing/video`.

Expected: PASS.

- [ ] **Step 6: Render the complete local deliverable set**

Run: `npm run render && npm run verify` from `marketing/video`.

Expected: four valid MP4 files, four matching SRT files, and a passing JSON report. Do not deliver a file that fails duration or format verification.

### Task 7: Human QA and delivery package

**Files:**
- Create: `marketing/video/out/README.md`
- Create: `marketing/video/qa-checklist.md`
- Modify: `marketing/video/data/proof/README.md` only if an approved metrics claim is actually included.

**Interfaces:**
- Consumes the rendered/verified package from Task 6.
- Produces a reviewer-readable delivery package with exact filenames and claim evidence status.

- [ ] **Step 1: Write the human QA checklist**

Include these checks: every caption is readable without sound; AI narration exactly matches captions; UI actions have enough dwell time to understand; no secrets/user data/private notes appear; the Premium screen is a sandbox/test flow; local reminder is not called OneSignal; all entered categories match the approved list; every claim has visual or proof support; and all videos play from beginning to end in VLC/QuickTime/Chrome.

- [ ] **Step 2: Review the flagship at normal speed and muted**

Open `out/ourweek-shipaton-2026.mp4` twice: first with audio, then muted. Mark each checklist item pass/fail. A caption obstruction, untrue claim, unreadable UI state, or runtime above 1:55 is a render blocker.

- [ ] **Step 3: Review each vertical cut in a phone-sized player**

Open each TikTok MP4 at a 9:16 phone viewport. Confirm its hook is entirely legible by 2 seconds, the story is complete without sound, and the end card remains visible for at least 1.5 seconds.

- [ ] **Step 4: Write the delivery README**

List the four MP4 files, four SRT files, master aspect ratio, runtime, audience, and a statement that OneSignal award claims are excluded pending a real integration and campaign. State whether any verified Grand Prize traction metric was included; if no evidence file exists, state “No traction metric included.”

- [ ] **Step 5: Final verification**

Run: `npm run verify` from `marketing/video`.

Expected: exit code 0 and an up-to-date `out/verification-report.json`.

## Plan self-review

**Spec coverage:** Task 2 encodes the approved 1:55 flagship, three short-form stories, language, caption, award, and claim constraints. Task 3 supplies safe real footage. Task 4 generates reviewed AI narration with the official text-to-speech endpoint. Task 5 makes the actual screen-recording composition, captions, end card, and SRT. Task 6 enforces all exported format and duration requirements. Task 7 requires audio/muted human review and provides delivery documentation. The plan explicitly excludes unsupported OneSignal claims and unproven traction metrics.

**Placeholder scan:** No `TBD`, `TODO`, or deferred implementation placeholders remain. Secrets and staging values are intentionally environment-provided and are never written into source files.

**Interface consistency:** `VideoBrief` begins in Task 1 and is the contract consumed by Tasks 2, 4, and 5. Output file names are declared in Task 6 and referenced consistently by Task 7.
