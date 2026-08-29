# Android Notification Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the OurWeek brand glyph, rather than Android's fallback icon, for local reminder notifications.

**Architecture:** Add one Android Vector Drawable solely for the notification small-icon surface. Both existing Capacitor Local Notifications use that drawable by resource name; launcher and splash assets remain unchanged.

**Tech Stack:** Android Vector Drawable XML, Capacitor Local Notifications 8.3.1, Vue 3 / TypeScript.

## Global Constraints

- Android small icons are monochrome white silhouettes with transparent backgrounds; do not reuse a full-colour adaptive launcher asset.
- Use the supplied OurWeek SVG paths with a `308 × 337` viewport and a 24dp intrinsic height.
- Change only Android reminder icon configuration; web development behaviour stays unchanged.
- Do not add dependencies, modify subscription behaviour, or commit without explicit user instruction.

---

### Task 1: Add and use the OurWeek notification drawable

**Files:**

- Modify: `android/app/src/main/res/drawable/ic_stat_ourweek.xml`
- Modify: `src/features/reminders/reminderService.ts:94-114`
- Test: Android device/emulator manual notification check

**Interfaces:**

- Consumes: `LocalNotificationSchema.smallIcon?: string`, interpreted by Capacitor Android as a drawable resource name.
- Produces: `@drawable/ic_stat_ourweek`, used by both locally scheduled reminder payloads.

- [ ] **Step 1: Populate the Android Vector Drawable**

Replace the empty file with a vector drawable using `android:width="22dp"`, `android:height="24dp"`, `android:viewportWidth="308"`, `android:viewportHeight="337"`, and the supplied three SVG `pathData` values. Set each path's `android:fillColor="#FFFFFFFF"`; do not include a background path.

- [ ] **Step 2: Reference the drawable from each reminder**

Add the same property to both notification objects in `scheduleReminderNotifications`:

```ts
smallIcon: 'ic_stat_ourweek',
```

Keep `id`, `title`, `body`, `channelId`, `autoCancel`, and `schedule` unchanged.

- [ ] **Step 3: Run static project checks**

Run:

```powershell
npm run build
npm run check
```

Expected: both commands exit successfully. The Android XML is not processed by the TypeScript build, so continue to the native verification step.

- [ ] **Step 4: Verify the native resource**

Run:

```powershell
npm run cap:sync
Set-Location android
.\gradlew.bat :app:assembleDebug
```

Expected: Gradle completes successfully, proving that `ic_stat_ourweek.xml` is valid Android resource XML.

- [ ] **Step 5: Verify on Android**

Install the debug APK, enable a reminder with notification permission granted, and wait for or temporarily schedule a reminder. Expected: the collapsed status bar shows the white OurWeek silhouette rather than the fallback information glyph; expanding the notification shows the standard Android-tinted small icon.

## Plan self-review

- Spec coverage: Task 1 creates the dedicated, transparent, white vector resource, applies it to both reminder types, preserves existing launcher/splash assets, and verifies the Android build and device rendering.
- Placeholder scan: no incomplete requirements or deferred implementation markers are present.
- Type consistency: both call sites use the documented `LocalNotificationSchema.smallIcon` string resource name `ic_stat_ourweek`.
