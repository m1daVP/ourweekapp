# Premium Product Roadmap

## Product Direction

OurWeek should be a trustworthy long-term record for a household. Free users
must retain access to the meetings, tasks, and agreements they created.
Premium should sell meaningful ongoing help: reducing work after a meeting,
supporting follow-through during the week, and revealing useful patterns over
time.

The subscription remains household-scoped: one workspace subscription unlocks
Premium capabilities for the household, while the workspace owner manages the
purchase.

## Principles

- Do not hold a household's historical record behind a paywall.
- On Premium expiry, disable new Premium automation and insights, but preserve
  read access and basic export of the household's own data.
- Paywall actions that create additional value or require ongoing service work,
  such as AI generation, calendar synchronization, and smart follow-ups.
- Keep the Free tier complete enough to establish a reliable weekly-meeting
  habit.
- Describe Premium in outcomes, not an inventory of locked features: it helps
  a household turn meetings into follow-through.

## Recommended Sequence

```text
Entitlement contract
  -> Trustworthy Free record
    -> Premium Assistant
      -> Guided meeting formats
        -> Connected household
          -> Insight and reflection
```

Each milestone below is intentionally independent enough to become a separate
detailed specification and implementation plan.

## Milestone 0: Entitlement Contract

### Goal

Create one clear, consistently enforced definition of Free and Premium access.

### Scope

- Define the plan and feature contract in product language.
- Align backend enforcement, frontend feature access, subscription status, and
  paywall copy with that contract.
- State the household subscription rule and owner-only billing management rule.
- Define the expired-subscription experience: historical content stays
  readable; new Premium actions are unavailable.
- Remove contradictory plan claims, such as a feature appearing Free in one
  place and unavailable in another.

### Outcome

Every feature has a single, explainable access rule. The app never presents a
benefit that the API will reject, or withholds a feature that the plan promises.

### Future Spec

`premium-entitlement-contract`

## Milestone 1: Free Family Record

### Goal

Make Free feel safe and useful permanently, so a household can trust OurWeek
with its shared history.

### Scope

- Give Free unlimited read access to completed meetings, tasks, and agreements.
- Remove the three-completed-meeting history restriction.
- Keep core weekly meetings, the default template, and core reminders Free.
- Keep raw account-data export and a basic export of household-created content
  Free.
- Replace history-based upgrade messaging with a clear Free-tier value
  statement.

### Outcome

A household can use OurWeek for a year without paying and still view its full
record. Canceling Premium never makes past family decisions disappear.

### Future Spec

`free-family-record-and-history-access`

## Milestone 2: Premium Assistant MVP

### Goal

Create the first compelling paid outcome: less work after a meeting and more
consistent follow-through during the week.

### Scope

- AI meeting recaps with decisions, tasks, and next steps.
- Smart follow-up reminders for unresolved agreements and overdue tasks.
- Contextual paywalls at useful moments, such as generating a recap or setting
  an automated follow-up.
- A lightweight acquisition mechanism: either a short household trial after
  the first meaningful completed meeting, or a small number of free AI recap
  credits.
- Clear household-plan messaging: one subscription covers the household.

### Product Decision

Start with a small number of free AI recap credits rather than an automatic
trial. Credits let users experience the value without a surprise renewal date
and create a natural upgrade moment after a completed meeting.

### Outcome

Users can explain Premium in one sentence: "It turns our meeting into
follow-through."

### Future Spec

`premium-assistant-mvp`

## Milestone 3: Premium Meeting Formats

### Goal

Help households use an appropriate meeting structure for situations beyond the
default weekly check-in.

### Scope

- Add a focused Premium template library.
- Start with couple reset, family with kids, money check-in, conflict cleanup,
  and busy-week planning.
- Keep the default weekly template Free.
- Position templates as guided outcomes rather than extra forms.

### Outcome

A household immediately recognizes a real situation where a Premium template
will help it have a better conversation.

### Future Spec

`premium-meeting-template-library`

## Milestone 4: Connected Household

### Goal

Make Premium useful between meetings by connecting agreed actions to the
household's existing calendar.

### Scope

- Google Calendar connection.
- Optional calendar events for meetings, task due dates, and agreement
  follow-ups.
- Clear controls for what syncs and which household adults can manage it.
- Reliable handling of connection, disconnection, and sync failures.

### Outcome

A completed meeting can become a calendar-supported plan for the week without
manual copying.

### Future Spec

`premium-calendar-and-follow-up-sync`

## Milestone 5: Insight and Reflection

### Goal

Create long-term Premium value for households that have built substantial
history.

### Scope

- Search across meetings, tasks, and agreements.
- Recurring-topic and follow-through insights.
- Advanced household statistics.
- Polished printable or shareable meeting reports.
- Private preparation notes for adults.

Raw account-data export remains Free. Premium reports improve presentation and
utility; they do not restrict access to a user's own data. Private notes should
be specified separately because visibility, authorization, and migration must
be designed with particular care.

### Outcome

Premium helps a household learn from its history, instead of merely storing it.

### Future Specs

- `premium-household-insights`
- `private-meeting-preparation-notes`
- `premium-reports-and-exports`

## Ongoing Monetization Learning

Begin measuring this alongside Milestone 2 and continue through later work.

- First completed meeting (activation).
- First AI recap or smart follow-up (Premium-value activation).
- Credit or trial conversion.
- Template adoption.
- Calendar connection rate.
- Household retention at 4, 8, and 12 weeks.
- Cancellation reasons.

Optimize for recurring, successful household meetings and voluntary Premium
adoption—not paywall clicks alone.

## Out of Scope

- Introducing individual-seat pricing.
- Restricting access to historical household data after cancellation.
- Building every Premium idea in a single release.
- Replacing the current subscription provider or payment platforms as part of
  this roadmap.
