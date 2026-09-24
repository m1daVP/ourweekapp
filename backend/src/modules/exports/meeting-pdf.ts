import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';

export type MeetingPdfTask = {
  title: string;
  description?: string;
  responsible?: string;
  dueDate?: string;
  status?: string;
};

export type MeetingPdfAgreement = {
  text: string;
  description?: string;
  participants?: string;
};

export type MeetingPdfSection = {
  title: string;
  prompt?: string;
  notes: Array<{ author?: string; createdAt?: string; text: string }>;
  tasks: MeetingPdfTask[];
  agreements: MeetingPdfAgreement[];
};

export type MeetingPdfDocument = {
  title: string;
  status: string;
  occurredOn: string;
  generatedOn: string;
  privateNotesNotice: string;
  summary?: {
    snapshotLabel?: string;
    observations?: Array<{
      title: string;
      explanation: string;
      question: string;
      reviewHorizonLabel: string;
      sources: string[];
    }>;
    shortSummary: string;
    mainTopics: string[];
    keyTensions: string[];
    agreements: string[];
    tasks: MeetingPdfTask[];
    suggestedNextMeetingFocus: string[];
  };
  sections: MeetingPdfSection[];
};

function assetPath(filename: string) {
  return fileURLToPath(new URL(`./assets/${filename}`, import.meta.url));
}

const fontPath = assetPath('NotoSans-Regular.ttf');
const headerLogoPath = assetPath('ourweek-header-logo.png');
const firstPageArtworkPath = assetPath('tally-header-band.png');

const page = {
  left: 48,
  right: 48,
  top: 72,
  bottom: 58,
};

const colors = {
  ink: '#26332a',
  muted: '#65746a',
  primary: '#557a5c',
  accent: '#e8f0e4',
  masthead: '#fffdfa',
  panel: '#f6f8f4',
  line: '#d4dfd1',
  white: '#ffffff',
};

function hasCyrillic(value: string) {
  return /[\u0400-\u052f]/u.test(value);
}

function fontFor(value: string) {
  return hasCyrillic(value) ? 'NotoSansCyrillic' : 'NotoSansLatin';
}

function applyFont(document: PDFKit.PDFDocument, value: string, size: number) {
  document.font(fontFor(value)).fontSize(size);
}

function contentWidth(document: PDFKit.PDFDocument) {
  return document.page.width - page.left - page.right;
}

function addPage(document: PDFKit.PDFDocument) {
  document.addPage();
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  const maximumY = document.page.height - page.bottom;

  if (document.y + height > maximumY) {
    addPage(document);
  }
}

function writeText(
  document: PDFKit.PDFDocument,
  value: string,
  options: {
    color?: string;
    indent?: number;
    size?: number;
    spacing?: number;
  } = {},
) {
  const indent = options.indent ?? 0;
  const size = options.size ?? 10;
  const width = contentWidth(document) - indent;
  const lineGap = options.spacing ?? 2;

  applyFont(document, value, size);
  document.fillColor(options.color ?? colors.ink);
  const height = document.heightOfString(value, { width, lineGap });
  ensureSpace(document, Math.min(height + 8, 150));
  document.text(value, page.left + indent, document.y, { width, lineGap });
}

function writeLabel(
  document: PDFKit.PDFDocument,
  label: string,
  value: string | undefined,
) {
  if (!value) {
    return;
  }

  const combined = `${label}: ${value}`;
  writeText(document, combined, { color: colors.muted, size: 8.5, spacing: 1 });
}

function writeBulletList(
  document: PDFKit.PDFDocument,
  title: string,
  values: string[],
) {
  if (values.length === 0) {
    return;
  }

  ensureSpace(document, 28);
  writeText(document, title, { color: colors.primary, size: 10.5 });
  document.moveDown(0.2);

  for (const value of values) {
    writeText(document, `• ${value}`, { indent: 8, size: 9.5, spacing: 1.5 });
  }

  document.moveDown(0.65);
}

function writeTaskCard(document: PDFKit.PDFDocument, task: MeetingPdfTask) {
  const details = [
    task.description,
    task.responsible ? `Responsible: ${task.responsible}` : undefined,
    task.dueDate ? `Due: ${task.dueDate}` : undefined,
    task.status ? `Status: ${task.status}` : undefined,
  ].filter((value): value is string => Boolean(value));
  const cardText = [task.title, ...details].join('\n');
  const width = contentWidth(document) - 20;

  applyFont(document, cardText, 9.5);
  const height = Math.max(
    46,
    document.heightOfString(cardText, { width: width - 24, lineGap: 2 }) + 24,
  );
  ensureSpace(document, Math.min(height + 8, 180));

  const x = page.left + 10;
  const y = document.y;
  document.roundedRect(x, y, width, height, 4).fill(colors.panel);
  document.roundedRect(x, y, 3, height, 2).fill(colors.primary);
  document.y = y + 10;
  writeText(document, task.title, { indent: 22, size: 10.5 });

  for (const detail of details) {
    writeText(document, detail, {
      color: colors.muted,
      indent: 22,
      size: 8.5,
      spacing: 1,
    });
  }

  document.y = y + height + 8;
}

function writeAgreementCard(document: PDFKit.PDFDocument, agreement: MeetingPdfAgreement) {
  const details = [agreement.description, agreement.participants]
    .filter((value): value is string => Boolean(value))
    .join('\n');
  const cardText = [agreement.text, details].filter(Boolean).join('\n');
  const width = contentWidth(document) - 20;

  applyFont(document, cardText, 9.5);
  const height = Math.max(
    42,
    document.heightOfString(cardText, { width: width - 24, lineGap: 2 }) + 22,
  );
  ensureSpace(document, Math.min(height + 8, 180));

  const x = page.left + 10;
  const y = document.y;
  document.roundedRect(x, y, width, height, 4).fill(colors.accent);
  document.y = y + 10;
  writeText(document, agreement.text, { indent: 22, size: 10.5 });

  if (agreement.description) {
    writeText(document, agreement.description, {
      color: colors.muted,
      indent: 22,
      size: 8.5,
      spacing: 1,
    });
  }

  if (agreement.participants) {
    writeText(document, `People: ${agreement.participants}`, {
      color: colors.muted,
      indent: 22,
      size: 8.5,
      spacing: 1,
    });
  }

  document.y = y + height + 8;
}

function writeCurrentPageMasthead(document: PDFKit.PDFDocument) {
  document.rect(0, 0, document.page.width, 42).fill(colors.masthead);
  document.image(headerLogoPath, page.left, 9, { fit: [124, 24] });
  document.rect(0, 40, document.page.width, 2).fill(colors.primary);
  document.y = page.top;
}

function writeFirstPageArtwork(document: PDFKit.PDFDocument) {
  document.image(firstPageArtworkPath, 0, 42, {
    width: document.page.width,
    height: 26,
  });
}

function writePageMastheads(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();

  writeCurrentPageMasthead(document);

  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    writeCurrentPageMasthead(document);
  }
}

function writePageFooters(document: PDFKit.PDFDocument, notice: string) {
  const range = document.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    const footerY = document.page.height - 36;
    document.moveTo(page.left, footerY - 8)
      .lineTo(document.page.width - page.right, footerY - 8)
      .strokeColor(colors.line)
      .lineWidth(0.5)
      .stroke();
    const bottomMargin = document.page.margins.bottom;
    document.page.margins.bottom = 0;

    try {
      applyFont(document, notice, 7.5);
      document.fillColor(colors.muted).text(notice, page.left, footerY, {
        width: contentWidth(document) - 80,
        lineBreak: false,
      });
      const pageNumber = `Page ${index + 1} of ${range.count}`;
      applyFont(document, pageNumber, 7.5);
      document.fillColor(colors.muted).text(pageNumber, document.page.width - page.right - 80, footerY, {
        width: 80,
        align: 'right',
        lineBreak: false,
      });
    } finally {
      document.page.margins.bottom = bottomMargin;
    }
  }
}

function writeSummary(document: PDFKit.PDFDocument, summary: NonNullable<MeetingPdfDocument['summary']>) {
  ensureSpace(document, 40);
  writeText(document, summary.observations ? 'Meeting follow-through' : 'Meeting recap', { color: colors.primary, size: 15 });
  document.moveDown(0.25);
  writeText(document, summary.snapshotLabel ?? 'Saved snapshot - freshness not verified.', { color: colors.muted, size: 8.5 });
  document.moveDown(0.4);
  writeText(document, summary.shortSummary, { size: 10.5, spacing: 2.5 });
  document.moveDown(0.75);

  if (summary.observations) {
    for (const observation of summary.observations) {
      ensureSpace(document, 100);
      writeText(document, observation.title, { color: colors.primary, size: 11.5 });
      writeText(document, observation.reviewHorizonLabel, { color: colors.muted, size: 8.5 });
      document.moveDown(0.3);
      writeText(document, observation.explanation, { size: 10 });
      document.moveDown(0.3);
      writeText(document, `Question: ${observation.question}`, { size: 10 });
      document.moveDown(0.3);
      for (const source of observation.sources) {
        writeText(document, source, { color: colors.muted, size: 8.5, spacing: 1 });
      }
      document.moveDown(0.8);
    }
    if (summary.observations.length === 0) {
      writeText(document, 'No additional follow-up observations.', { color: colors.muted, size: 9.5 });
    }
    return;
  }

  writeBulletList(document, 'Main topics', summary.mainTopics);
  writeBulletList(document, 'Tensions to revisit', summary.keyTensions);
  writeBulletList(document, 'Agreements made', summary.agreements);

  if (summary.tasks.length > 0) {
    ensureSpace(document, 28);
    writeText(document, 'Recorded tasks', { color: colors.primary, size: 10.5 });
    document.moveDown(0.3);
    summary.tasks.forEach((task) => writeTaskCard(document, task));
    document.moveDown(0.45);
  }

  writeBulletList(document, 'Next meeting focus', summary.suggestedNextMeetingFocus);
}

function writeSection(document: PDFKit.PDFDocument, section: MeetingPdfSection) {
  ensureSpace(document, 42);
  document.moveDown(0.45);
  document.moveTo(page.left, document.y)
    .lineTo(document.page.width - page.right, document.y)
    .strokeColor(colors.line)
    .lineWidth(0.8)
    .stroke();
  document.moveDown(0.7);
  writeText(document, section.title, { color: colors.primary, size: 14 });

  if (section.prompt) {
    document.moveDown(0.15);
    writeText(document, section.prompt, { color: colors.muted, size: 9.5, spacing: 1.5 });
  }

  if (section.notes.length > 0) {
    document.moveDown(0.7);
    writeText(document, 'Notes', { color: colors.primary, size: 10.5 });
    document.moveDown(0.2);
    for (const note of section.notes) {
      const prefix = [note.author, note.createdAt].filter(Boolean).join(' · ');
      if (prefix) {
        writeText(document, prefix, { color: colors.muted, size: 8.5 });
      }
      writeText(document, note.text, { indent: 8, size: 9.5, spacing: 1.5 });
      document.moveDown(0.4);
    }
  }

  if (section.tasks.length > 0) {
    document.moveDown(0.35);
    writeText(document, 'Tasks', { color: colors.primary, size: 10.5 });
    document.moveDown(0.3);
    section.tasks.forEach((task) => writeTaskCard(document, task));
  }

  if (section.agreements.length > 0) {
    document.moveDown(0.35);
    writeText(document, 'Agreements', { color: colors.primary, size: 10.5 });
    document.moveDown(0.3);
    section.agreements.forEach((agreement) => writeAgreementCard(document, agreement));
  }
}

export async function renderMeetingPdf(input: MeetingPdfDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margins: {
        top: page.top,
        right: page.right,
        bottom: page.bottom,
        left: page.left,
      },
      bufferPages: true,
      info: {
        Title: input.title,
        Author: 'OurWeek',
        Subject: 'Meeting export',
      },
    });
    const chunks: Buffer[] = [];

    document.registerFont('NotoSansLatin', fontPath);
    document.registerFont('NotoSansCyrillic', fontPath);
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('pageAdded', () => writeCurrentPageMasthead(document));
    writeFirstPageArtwork(document);
    writeText(document, input.title, { color: colors.ink, size: 22, spacing: 3 });
    document.moveDown(0.25);
    writeText(document, `${input.occurredOn}  ·  ${input.status}`, {
      color: colors.muted,
      size: 9.5,
    });
    document.moveDown(1);

    if (input.summary) {
      writeSummary(document, input.summary);
    }

    for (const section of input.sections) {
      writeSection(document, section);
    }

    if (!input.summary && input.sections.length === 0) {
      writeText(document, 'No shared meeting content was recorded.', {
        color: colors.muted,
        size: 10,
      });
    }

    writePageFooters(document, input.privateNotesNotice);
    writePageMastheads(document);
    document.end();
  });
}
