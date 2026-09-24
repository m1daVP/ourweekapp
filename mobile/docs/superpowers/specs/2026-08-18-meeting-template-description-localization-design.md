# Meeting Template Description Localization

## Goal

Show each meeting template description in the active application language.

## Current behavior

The locale catalog already defines descriptions for every meeting template in English, Ukrainian, and Spanish. `TemplateCard.vue` defines a second, English-only description map and uses it before the localization helper. That map overrides the translated text on every template card.

## Design

Remove the component-local `templateDescriptionMap`. `TemplateCard` will use `getMeetingTemplateDescription(template.id, template.description)` directly.

The helper resolves the active locale key at `templates.<meetingType>.description`. If a key is unavailable, it safely falls back to the template's stored default description.

## Scope

- Update `src/features/meeting/components/TemplateCard.vue` only.
- Reuse the existing locale catalog and localization helper.
- Do not change template names, sections, layout, or meeting data.

## Verification

Run `npm run build` and `npm run check`. Manually verify that template card descriptions switch with the app locale.
