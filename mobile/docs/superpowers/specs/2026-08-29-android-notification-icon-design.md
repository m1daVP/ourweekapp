# Android notification icon

## Goal

Replace Android's fallback notification glyph with the OurWeek brand mark for locally scheduled reminders.

## Scope

- Use the supplied OurWeek SVG paths to populate `android/app/src/main/res/drawable/ic_stat_ourweek.xml` as an Android Vector Drawable.
- Render the resource as a transparent, white 24dp small notification icon.
- Set `smallIcon: 'ic_stat_ourweek'` on the weekly-meeting and unfinished-items notifications in `src/features/reminders/reminderService.ts`.

## Design

The drawable keeps the supplied mark's three SVG paths and original `308 × 337` viewport. It is scaled by the Android Vector Drawable to a 24dp intrinsic height and proportionate 22dp width. All paths use opaque white, which gives Android a valid monochrome status-bar silhouette. The status bar applies the system tint; no colored background is included.

The launcher and splash artwork stay unchanged because notification small icons have different Android rendering requirements.

## Behaviour and verification

Both existing recurring reminder types use the same resource name. Browser development remains unchanged because local notification scheduling is native-only. Verify with an Android build by scheduling either reminder and checking that the status bar shows the white OurWeek glyph rather than Android's fallback symbol.
