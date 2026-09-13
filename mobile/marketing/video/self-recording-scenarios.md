# OurWeek self-recording scenarios — Shipaton and social promos

**Date:** 2026-09-11  
**Production model:** app-only Android captures; no face, hands, stock footage, or fabricated screens  
**Languages:** separate English and Ukrainian editions

## Deliverables

| Video                             | Format                  | Target runtime | Voice                                |
| --------------------------------- | ----------------------- | -------------: | ------------------------------------ |
| Shipaton project presentation     | 16:9, 1920×1080, 30 fps |   1:55 maximum | Founder's own voice                  |
| Promo 1 — The 15-minute ritual    | 9:16, 1080×1920, 30 fps |     25 seconds | AI voice plus a subtitle-only export |
| Promo 2 — The same conversation   | 9:16, 1080×1920, 30 fps |     27 seconds | AI voice plus a subtitle-only export |
| Promo 3 — Give the task an owner  | 9:16, 1080×1920, 30 fps |     24 seconds | AI voice plus a subtitle-only export |
| Promo 4 — Bring it into next week | 9:16, 1080×1920, 30 fps |     26 seconds | AI voice plus a subtitle-only export |
| Promo 5 — A shared memory         | 9:16, 1080×1920, 30 fps |     28 seconds | AI voice plus a subtitle-only export |

Create a separate English and Ukrainian edition of every video. Record the app UI in the matching language; do not place Ukrainian narration over English UI or the reverse.

## Prepare the Android phone

1. Use a staging or demo build with a fictional account only.
2. Set the phone to 1080p screen recording, 30 fps, portrait orientation, and show taps if Android offers that option.
3. Turn on Do Not Disturb. Hide notification previews, email address, status-bar carrier details, and any debug overlay.
4. Use light mode, 100% display size, and the default font size. Keep battery above 50%.
5. Record clean app audio with no microphone. Narration and music are added later.
6. Begin every capture with two seconds of stillness and finish with two seconds of stillness.
7. Make one deliberate tap every 1–2 seconds. After a saved item appears, do not move for at least one second.
8. Record English and Ukrainian source clips separately after changing the app language in Settings.

## Demo household and reusable data

Use exactly one fictional household so every video feels like part of the same story.

| Field                    | English edition                                        | Ukrainian edition                                     |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------- |
| Participants             | Maya, Leo                                              | Мая, Лео                                              |
| Positive note            | Saturday breakfast felt relaxed.                       | Суботній сніданок був спокійним.                      |
| Tension note             | Mornings felt rushed this week.                        | Цього тижня ранки були поспішними.                    |
| Main task                | Book the dentist appointment                           | Записатися до стоматолога                             |
| Task owner               | Leo                                                    | Лео                                                   |
| Task due date            | Next Friday                                            | Наступна п’ятниця                                     |
| Agreement                | We will prepare kindergarten clothes the night before. | Ми готуватимемо одяг для садочка ввечері напередодні. |
| Existing unfinished task | Compare internet plans                                 | Порівняти інтернет-тарифи                             |
| Meeting                  | Weekly family check-in                                 | Щотижнева сімейна зустріч                             |

Seed one earlier completed meeting containing the unfinished task before recording. Use Premium only in the captures that show AI, full history, reminders, or the purchase flow. The purchase screen must use RevenueCat sandbox/test mode and must not show a real payment method.

## Shared edit and subtitle rules

- Keep captions inside the central 80% of the frame. On vertical videos, keep them above the bottom 420 px and below the top 260 px so platform controls do not cover them.
- Use no more than two subtitle lines. Aim for 3–7 words per line.
- Use sentence case, off-white text, a soft dark translucent backing, and sage emphasis on at most one phrase.
- Do not animate every word. Fade each caption in over 4–6 frames and out over 4–6 frames.
- Use direct cuts between meaningful states. A 6–10 frame crossfade is acceptable between unrelated screens.
- For the 16:9 Shipaton edit, place the uncropped portrait recording in the center of a plain warm-off-white canvas. Use the free side area for subtitles or a short heading; do not add a fake phone body. For the 9:16 promos, let the recording fill the frame.
- Crop away keyboard suggestions that reveal personal data. If typing looks slow, cut from the first two characters to the completed safe demo text.
- Background music should be instrumental, warm, and unobtrusive. Duck it to approximately −26 LUFS under narration; export the spoken mix near −14 LUFS integrated.
- The subtitle-only promo export keeps the captions and music but removes the AI narration. It must remain completely understandable.

# 1. Shipaton project presentation

## Recording plan

Record the scenes as separate source clips. Do not attempt a single continuous 1:55 performance.

| Time      | Scene and exact actions                                                                                                                                                                       | Edit direction                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:07 | Begin on the OurWeek Home screen with Maya & Leo visible. Hold for two seconds. Slowly scroll just enough to reveal the task and history shortcuts. Do not tap yet.                           | Start immediately on the product. Add the title `Small decisions need a place to land.` / `Малим рішенням потрібне надійне місце.` |
| 0:07–0:15 | Tap **Tasks**, reveal `Compare internet plans`, then cut to **History** showing the earlier meeting.                                                                                          | Use two clean cuts. Add a subtle 105% zoom toward the unfinished task and earlier meeting card.                                    |
| 0:15–0:24 | Return Home. Tap **Start meeting**. On Templates, keep **Weekly family check-in** selected and tap **Start meeting**.                                                                         | Let each selection state remain visible for one second.                                                                            |
| 0:24–0:32 | On check-in, tap Maya and Leo, then tap **Start ritual**.                                                                                                                                     | Add a small tap ring only if native tap indicators are not recorded.                                                               |
| 0:32–0:42 | On **Good things**, choose Maya, enter the positive note, and save it. Then cut to **Tensions**, enter the tension note, and save it.                                                         | Speed up typing to 1.5×, but show the final text at normal speed.                                                                  |
| 0:42–0:55 | Continue to **Tasks**. Tap add task, enter `Book the dentist appointment`, choose Leo as the responsible person, select next Friday, and save.                                                | Hold on the saved task with Leo's name and due date readable.                                                                      |
| 0:55–1:06 | Continue to **Final agreements**. Add the kindergarten-clothes agreement, select both participants/shared responsibility, and save it.                                                        | Reframe toward the final saved agreement. Do not show an empty editor.                                                             |
| 1:06–1:15 | Move to **Review & close**. Slowly scroll through Agreed actions and Agreements. Tap **Finish** and wait for completion.                                                                      | Keep the 100% progress and saved outcomes readable.                                                                                |
| 1:15–1:27 | Open the completed meeting summary. Tap **Generate AI summary** only if the demo Premium entitlement is active. Show the disclosure if it appears, confirm it, then show the completed recap. | Remove provider wait time. Cut from the loading state to the finished summary; do not imply it is instantaneous.                   |
| 1:27–1:37 | Open **Tasks**, show the newly assigned dentist task, then open **History** and the completed meeting.                                                                                        | Use a split sequence, not a split screen. Each item gets approximately five seconds.                                               |
| 1:37–1:47 | From Settings on a Free demo state, tap **Upgrade to Premium**. Show the real localized plans and Android/RevenueCat sandbox purchase sheet. Do not complete a charge.                        | The visible store price is the only price claim. Blur any store account identifier if Android exposes one.                         |
| 1:47–1:52 | Cut to Settings on the Premium demo state. Open reminder settings, enable the weekly reminder, and show a separately recorded genuine Android notification.                                   | Label it `Local Android reminder` / `Локальне нагадування Android`. Do not mention OneSignal.                                      |
| 1:52–1:55 | End card: OurWeek logo, `A calmer weekly rhythm.` / `Спокійніший щотижневий ритм.` and the applicable Shipaton categories.                                                                    | No narration after 1:54. Hold the logo through the final frame.                                                                    |

## English voice-over and subtitles

Read naturally at a calm pace. The subtitle text below is already split into readable phrases; it may be burned in exactly as written.

| Time      | Voice-over                                                                                                                              | Burned-in subtitle                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0:00–0:07 | Small household problems rarely begin as big problems. They grow when decisions have nowhere to stay.                                   | Small problems grow<br>when decisions disappear.                |
| 0:07–0:15 | A task is mentioned, nobody owns it, and the same conversation returns next Sunday.                                                     | No owner. No follow-through.<br>The conversation returns.       |
| 0:15–0:24 | I built OurWeek to give couples and families one calm, guided place for that weekly conversation.                                       | One calm place<br>for the weekly conversation.                  |
| 0:24–0:32 | Choose who is here, start the ritual, and move through a simple structure together.                                                     | Choose who is here.<br>Start together.                          |
| 0:32–0:42 | Begin with what went well, then name what felt stressful without turning the app into therapy.                                          | Notice what worked.<br>Name what felt difficult.                |
| 0:42–0:55 | When something needs action, turn it into a task with one clear owner and a due date.                                                   | One task.<br>One clear owner.                                   |
| 0:55–1:06 | When you make a decision together, save it as an agreement everyone can return to.                                                      | Save the decision<br>you made together.                         |
| 1:06–1:15 | Before you finish, OurWeek brings the actions, agreements, and notes into one shared review.                                            | Review the outcome<br>before you finish.                        |
| 1:15–1:27 | Premium can create an AI-assisted recap from the meeting. It is reviewed in the app, not treated as unquestionable advice.              | An AI-assisted recap,<br>ready to review.                       |
| 1:27–1:37 | After the meeting, tasks and history stay connected, so unfinished details do not depend on memory.                                     | Tasks and history<br>stay connected.                            |
| 1:37–1:47 | The core ritual is free. Premium adds deeper history, AI summaries, reminders, templates, calendar sync, and export through RevenueCat. | Free for the core ritual.<br>Premium for deeper follow-through. |
| 1:47–1:52 | A gentle local Android reminder brings the household back for the next weekly check-in.                                                 | A gentle reminder<br>for next week.                             |
| 1:52–1:55 | This is OurWeek: small agreements, remembered.                                                                                          | OurWeek<br>Small agreements, remembered.                        |

## Ukrainian voice-over and subtitles

| Time      | Voice-over                                                                                                                                         | Burned-in subtitle                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0:00–0:07 | Побутові проблеми рідко починаються великими. Вони ростуть, коли рішенням ніде зберігатися.                                                        | Малі проблеми ростуть,<br>коли рішення зникають.            |
| 0:07–0:15 | Про завдання згадали, відповідального немає — і наступної неділі розмова повторюється.                                                             | Немає відповідального.<br>Розмова повторюється.             |
| 0:15–0:24 | Я створив OurWeek, щоб дати парам і сім’ям спокійний, структурований простір для щотижневої розмови.                                               | Спокійний простір<br>для щотижневої розмови.                |
| 0:24–0:32 | Оберіть учасників, почніть ритуал і разом пройдіть просту послідовність кроків.                                                                    | Оберіть учасників.<br>Почніть разом.                        |
| 0:32–0:42 | Спочатку згадайте хороше, а потім назвіть те, що було складним — без спроб перетворити застосунок на терапію.                                      | Помітьте, що вдалося.<br>Назвіть складне.                   |
| 0:42–0:55 | Якщо щось потребує дії, перетворіть це на завдання з відповідальним і терміном.                                                                    | Одне завдання.<br>Один відповідальний.                      |
| 0:55–1:06 | Якщо ви разом щось вирішили, збережіть це як домовленість, до якої можна повернутися.                                                              | Збережіть спільне<br>рішення.                               |
| 1:06–1:15 | Перед завершенням OurWeek збирає дії, домовленості й нотатки в одному спільному огляді.                                                            | Перегляньте результат<br>перед завершенням.                 |
| 1:15–1:27 | Premium може створити AI-підсумок зустрічі. Його можна перевірити в застосунку, а не сприймати як беззаперечну пораду.                             | AI-підсумок,<br>готовий до перевірки.                       |
| 1:27–1:37 | Після зустрічі завдання та історія залишаються пов’язаними, тому незавершені справи не залежать від пам’яті.                                       | Завдання й історія<br>залишаються разом.                    |
| 1:37–1:47 | Основний ритуал безкоштовний. Premium додає повну історію, AI-підсумки, нагадування, шаблони, синхронізацію календаря та експорт через RevenueCat. | Основний ритуал безкоштовний.<br>Premium — для продовження. |
| 1:47–1:52 | Лагідне локальне нагадування Android повертає родину до наступної щотижневої зустрічі.                                                             | Лагідне нагадування<br>на наступний тиждень.                |
| 1:52–1:55 | Це OurWeek: малі домовленості, які не забуваються.                                                                                                 | OurWeek<br>Домовленості, які не забуваються.                |

## Shipaton voice performance

- Record standing or seated upright in a quiet, soft-furnished room, 15–20 cm from the microphone.
- Speak as the builder explaining a real product, not as a commercial announcer.
- Record one sentence per take. Leave one second before and after every sentence.
- Emphasize **OurWeek**, **one clear owner**, **review**, and **core ritual is free**.
- Do not rush the Premium list. If the Ukrainian take exceeds the cue, shorten pauses rather than speeding up the words.

# 2. Promo 1 — The 15-minute ritual

**Goal:** introduce the whole habit in one compressed story.  
**Runtime:** 25 seconds.

## Actions

| Time      | App action                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------- |
| 0:00–0:03 | Home screen. Hold on the **15-minute weekly check-in** card, then tap **Start meeting**.                |
| 0:03–0:07 | Select **Weekly family check-in**, select Maya and Leo, and tap **Start ritual**. Use three quick cuts. |
| 0:07–0:12 | Show the positive note saved under **Good things**.                                                     |
| 0:12–0:18 | Show the dentist task with Leo selected, then the saved agreement.                                      |
| 0:18–0:23 | Show **Review & close** with the task and agreement visible. Tap **Finish**.                            |
| 0:23–0:25 | OurWeek logo and CTA.                                                                                   |

## Script

| Time      | English AI voice + subtitle                          | Ukrainian AI voice + subtitle                                |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| 0:00–0:03 | A weekly check-in that actually ends with a plan.    | Щотижнева розмова, яка справді завершується планом.          |
| 0:03–0:07 | Choose who is here and start together.               | Оберіть учасників і почніть разом.                           |
| 0:07–0:12 | Notice what worked. Name what felt difficult.        | Згадайте, що вдалося. Назвіть те, що було складним.          |
| 0:12–0:18 | Give the next task an owner, and save the agreement. | Призначте відповідального й збережіть домовленість.          |
| 0:18–0:23 | Fifteen calm minutes. One shared plan for the week.  | П’ятнадцять спокійних хвилин. Один спільний план на тиждень. |
| 0:23–0:25 | Meet OurWeek.                                        | Знайомтеся: OurWeek.                                         |

**End-card CTA:** `Join the waitlist` / `Приєднуйтеся до списку очікування`

**English post copy:** What if the weekly household conversation had a beginning, a structure, and a clear ending? OurWeek turns 15 calm minutes into tasks and agreements you can revisit. Join the waitlist.  
**Ukrainian post copy:** А що, якби щотижнева сімейна розмова мала початок, структуру й чітке завершення? OurWeek перетворює 15 спокійних хвилин на завдання та домовленості, до яких можна повернутися. Приєднуйтеся до списку очікування.  
**Hashtags:** `#OurWeek #Shipaton #FamilyApp #WeeklyCheckIn #BuildInPublic`

# 3. Promo 2 — Stop repeating the same conversation

**Goal:** make the pain immediately recognizable.  
**Runtime:** 27 seconds.

## Actions

| Time      | App action                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| 0:00–0:04 | Open History and show the older meeting with `Compare internet plans` still unfinished.                     |
| 0:04–0:09 | Start a new meeting and advance to the review-unfinished-items step.                                        |
| 0:09–0:15 | Hold on the old task, choose to keep/carry it forward, and confirm.                                         |
| 0:15–0:22 | Show the carried-forward item inside the current meeting and assign it to Maya if the UI asks for an owner. |
| 0:22–0:25 | Show the updated shared review.                                                                             |
| 0:25–0:27 | Logo and CTA.                                                                                               |

## Script

| Time      | English AI voice + subtitle                                  | Ukrainian AI voice + subtitle                                |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 0:00–0:04 | We discussed it last Sunday. Then we forgot what we decided. | Ми обговорили це минулої неділі. А потім забули рішення.     |
| 0:04–0:09 | So the same conversation came back again.                    | І та сама розмова почалася знову.                            |
| 0:09–0:15 | OurWeek brings unfinished items into the next check-in.      | OurWeek переносить незавершені справи до наступної зустрічі. |
| 0:15–0:22 | Keep it, update it, or close it together.                    | Залиште, оновіть або закрийте справу разом.                  |
| 0:22–0:25 | No blame. Just a clear next step.                            | Без звинувачень. Лише зрозумілий наступний крок.             |
| 0:25–0:27 | Remember it with OurWeek.                                    | Не забувайте з OurWeek.                                      |

**End-card CTA:** `Follow the build` / `Стежте за розробкою`

**English post copy:** The problem is not always the conversation. Sometimes it is that nothing survives after it. OurWeek keeps unfinished household follow-ups ready for next week.  
**Ukrainian post copy:** Проблема не завжди в самій розмові. Іноді після неї просто нічого не зберігається. OurWeek тримає незавершені сімейні справи готовими до наступного тижня.  
**Hashtags:** `#OurWeek #CouplesApp #FamilyPlanning #WeeklyMeeting #BuildInPublic`

# 4. Promo 3 — Give every task a clear owner

**Goal:** show one practical differentiator in a single uninterrupted action.  
**Runtime:** 24 seconds.

## Actions

| Time      | App action                                                                                |
| --------- | ----------------------------------------------------------------------------------------- |
| 0:00–0:04 | Begin in the Tasks section of an active meeting with the empty add-task form ready.       |
| 0:04–0:10 | Type `Book the dentist appointment`. Cut from the first characters to the complete title. |
| 0:10–0:15 | Open the responsibility picker and choose Leo. Select next Friday.                        |
| 0:15–0:21 | Save and hold on the resulting task card with owner and due date readable.                |
| 0:21–0:24 | Logo and CTA.                                                                             |

## Script

| Time      | English AI voice + subtitle                             | Ukrainian AI voice + subtitle                 |
| --------- | ------------------------------------------------------- | --------------------------------------------- |
| 0:00–0:04 | “We should do that” is not a plan.                      | «Треба це зробити» — ще не план.              |
| 0:04–0:10 | Write down the next action while you are still talking. | Запишіть наступну дію просто під час розмови. |
| 0:10–0:15 | Choose who will take care of it, and by when.           | Оберіть, хто це зробить і до якого дня.       |
| 0:15–0:21 | Now everyone leaves with the same clear expectation.    | Тепер усі однаково розуміють наступний крок.  |
| 0:21–0:24 | Make it clear with OurWeek.                             | Зробіть це зрозумілим з OurWeek.              |

**End-card CTA:** `One task. One owner.` / `Одне завдання. Один відповідальний.`

**English post copy:** A task without an owner is usually just a wish. OurWeek lets the household agree on the action, responsibility, and due date before the conversation ends.  
**Ukrainian post copy:** Завдання без відповідального часто залишається лише побажанням. OurWeek допомагає узгодити дію, відповідального й термін ще до завершення розмови.  
**Hashtags:** `#OurWeek #HouseholdTasks #FamilyOrganization #ProductDemo #Shipaton`

# 5. Promo 4 — Bring unfinished decisions into next week

**Goal:** demonstrate continuity without presenting the app as a nagging task tracker.  
**Runtime:** 26 seconds.

## Actions

| Time      | App action                                                                             |
| --------- | -------------------------------------------------------------------------------------- |
| 0:00–0:04 | Start on a completed meeting's saved agreement. Zoom gently toward the agreement text. |
| 0:04–0:10 | Cut to the next meeting's unfinished-item review showing that agreement/task again.    |
| 0:10–0:16 | Tap the option that keeps it relevant for this week.                                   |
| 0:16–0:22 | Show reminder settings, then a genuine local Android follow-up notification.           |
| 0:22–0:24 | Return to the meeting and show the item ready for review.                              |
| 0:24–0:26 | Logo and CTA.                                                                          |

## Script

| Time      | English AI voice + subtitle                                  | Ukrainian AI voice + subtitle                             |
| --------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 0:00–0:04 | A good agreement should not disappear when the meeting ends. | Хороша домовленість не має зникати після зустрічі.        |
| 0:04–0:10 | OurWeek keeps unfinished follow-ups ready for next week.     | OurWeek готує незавершені справи до наступного тижня.     |
| 0:10–0:16 | Together, decide whether each one is still relevant.         | Разом вирішіть, чи справа досі актуальна.                 |
| 0:16–0:22 | A gentle local reminder helps you return when it is time.    | Лагідне локальне нагадування допоможе повернутися вчасно. |
| 0:22–0:24 | Follow through without the blame.                            | Продовжуйте без звинувачень.                              |
| 0:24–0:26 | Keep the right things moving.                                | Рухайте важливі справи далі.                              |

**End-card CTA:** `Carry the right things forward` / `Переносьте далі те, що важливо`

**English post copy:** Not everything gets finished in one week. OurWeek makes that normal: review what remains, keep what still matters, and close what no longer does.  
**Ukrainian post copy:** Не все завершується за один тиждень — і це нормально. В OurWeek можна переглянути незавершене, залишити важливе й закрити те, що вже неактуальне.  
**Hashtags:** `#OurWeek #SharedAgreements #WeeklyReset #FamilyLife #BuildInPublic`

# 6. Promo 5 — A shared memory with history and AI recap

**Goal:** present Premium value without overselling AI.  
**Runtime:** 28 seconds.

## Actions

| Time      | App action                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------- |
| 0:00–0:04 | Open a completed meeting summary. Hold on the task and agreement count.                             |
| 0:04–0:10 | Scroll through the saved recap and open History.                                                    |
| 0:10–0:17 | Return to the meeting summary and generate/show the AI-assisted recap. Cut out the wait.            |
| 0:17–0:23 | Slowly scroll the finished summary so the short overview and one useful observation are visible.    |
| 0:23–0:26 | Show the Premium screen with the real localized store price. Do not start a purchase in this short. |
| 0:26–0:28 | Logo and CTA.                                                                                       |

## Script

| Time      | English AI voice + subtitle                                               | Ukrainian AI voice + subtitle                                          |
| --------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0:00–0:04 | What did we agree on three weeks ago?                                     | Про що ми домовилися три тижні тому?                                   |
| 0:04–0:10 | OurWeek keeps meetings, tasks, and agreements in one shared history.      | OurWeek зберігає зустрічі, завдання й домовленості в спільній історії. |
| 0:10–0:17 | Premium can also create an AI-assisted recap from the conversation.       | Premium також може створити AI-підсумок розмови.                       |
| 0:17–0:23 | Review the summary, keep what is useful, and return whenever you need it. | Перевірте підсумок, залиште корисне й повертайтеся за потреби.         |
| 0:23–0:26 | Your weekly conversation now has a memory.                                | Тепер ваша щотижнева розмова має пам’ять.                              |
| 0:26–0:28 | Remember together with OurWeek.                                           | Пам’ятайте разом з OurWeek.                                            |

**End-card CTA:** `Join the OurWeek waitlist` / `Приєднуйтеся до списку OurWeek`

**English post copy:** Household decisions are useful only if you can find them later. OurWeek keeps a shared meeting history, while Premium adds reviewable AI-assisted recaps and deeper follow-through.  
**Ukrainian post copy:** Сімейні рішення корисні лише тоді, коли їх можна знайти пізніше. OurWeek зберігає спільну історію зустрічей, а Premium додає AI-підсумки, які можна перевірити, та глибше продовження домовленостей.  
**Hashtags:** `#OurWeek #AISummary #FamilyApp #RevenueCat #Shipaton`

# Capture order that minimizes resets

Record in this order for each language:

1. Seeded Home, Tasks, and History states.
2. Start one new weekly meeting and record check-in.
3. Record the Good things and Tensions entries.
4. Record task creation and agreement creation.
5. Record Review & close and finish the meeting.
6. Record the finished summary and AI recap.
7. Record Tasks and History after completion.
8. Switch to the Free sandbox account/state and record the Premium screen and RevenueCat purchase sheet.
9. Return to Premium and record reminder settings plus the genuine Android notification.
10. Repeat after changing the app language and resetting the fictional data.

Keep every raw clip. The five promos can reuse Shipaton source footage, but render their crops and pacing independently.

# Final quality checklist

- [ ] No real account, email, notification, payment, or household data appears.
- [ ] English narration is paired only with English UI and subtitles.
- [ ] Ukrainian narration is paired only with Ukrainian UI and subtitles.
- [ ] The Shipaton presentation ends by 1:55.
- [ ] Every promo is understandable with the narration muted.
- [ ] Important UI remains visible behind captions.
- [ ] No text sits under TikTok, Reels, or Shorts interface controls.
- [ ] AI is described as assisted and reviewable, never infallible.
- [ ] The store price is shown live and never hard-coded in narration.
- [ ] The purchase flow is RevenueCat sandbox/test mode.
- [ ] The reminder is genuine and clearly described as local Android behavior.
- [ ] No OneSignal, therapy, clinical, traction, revenue, or unsupported privacy claim appears.
- [ ] End cards remain on screen for at least two seconds.
- [ ] Watch every export once with sound and once muted before posting.
