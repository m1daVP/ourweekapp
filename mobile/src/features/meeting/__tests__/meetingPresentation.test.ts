import { describe, expect, it } from 'vitest';
import { meetingTemplates } from '../meetingTemplates';
import {
  getSectionPresentation,
  getTemplatePresentation,
  isAllowedCaptureType,
} from '../meetingPresentation';

describe('meeting presentation', () => {
  it('gives every template a final review and every conversation a valid primary action', () => {
    for (const template of meetingTemplates) {
      const presentation = getTemplatePresentation(template);
      const finalSection = presentation.at(-1);

      expect(finalSection).toMatchObject({ screenKind: 'review' });

      for (const section of presentation.slice(0, -1)) {
        expect(section).not.toBeNull();
        expect(section?.screenKind).toBe('conversation');
        expect(section?.primaryCaptureType).toBeDefined();
        expect(
          section?.allowedItemTypes.includes(section.primaryCaptureType!)
        ).toBe(true);
        expect(section?.addActionLabelKey).toBeTruthy();
      }
    }
  });

  it('constrains capture types by template section', () => {
    const goodThings = getSectionPresentation(
      'weekly-family-check-in',
      'goodThings'
    );
    const money = getSectionPresentation('weekly-family-check-in', 'money');

    expect(isAllowedCaptureType(goodThings, 'note')).toBe(true);
    expect(isAllowedCaptureType(goodThings, 'task')).toBe(false);
    expect(isAllowedCaptureType(money, 'agreement')).toBe(true);
  });

  it('gives an unknown historical section a safe note-only fallback', () => {
    expect(
      getSectionPresentation('weekly-family-check-in', 'backupPlans', 1, 3)
    ).toMatchObject({
      allowedItemTypes: ['note'],
      primaryCaptureType: 'note',
      screenKind: 'conversation',
    });
  });
});
