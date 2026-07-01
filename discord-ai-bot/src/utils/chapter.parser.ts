import { TextRun } from 'docx';

export interface Chapter {
  title: string;
  content: string;
}

/**
 * Splits text by '**' and returns docx TextRun elements with bold styling for matches.
 */
export function parseTextWithBold(inputText: string, options: { defaultBold?: boolean; italics?: boolean; color?: string } = {}): TextRun[] {
  const parts = inputText.split('**');
  return parts.map((part, idx) => {
    const isBold = idx % 2 === 1;
    return new TextRun({
      text: part,
      bold: options.defaultBold || isBold,
      italics: options.italics,
      color: options.color,
      size: 20 // default font size 10pt
    });
  });
}

/**
 * Helper to strip conversational AI pleasantries from response body.
 */
export function stripConversationalPleasantries(text: string): string {
  const lines = text.split('\n');
  let startIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      startIndex = i + 1;
      continue;
    }
    // Match common Indonesian / English AI pleasantries or intro headers
    if (
      /^(tentu|berikut|baik|halo|hi|berikut adalah|ini adalah|tentu saja|halo\s+\w+)/i.test(trimmed) ||
      ((trimmed.startsWith('#') || trimmed.startsWith('##') || trimmed.startsWith('###')) && 
       (/intro/i.test(trimmed) || /📖/g.test(trimmed))) ||
      trimmed.includes('📖')
    ) {
      startIndex = i + 1;
    } else {
      break;
    }
  }
  return lines.slice(startIndex).join('\n').trim();
}

/**
 * Helper to strip the entire Introduction block up to the next header.
 */
export function stripIntroductionSection(text: string): string {
  const lines = text.split('\n');
  let introStartIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const trimmed = lines[i].trim();
    const normalized = trimmed.replace(/[^\w\s]/g, '').trim().toLowerCase();
    
    if (normalized === 'introduction' || normalized === 'pendahuluan' || normalized === 'intro') {
      introStartIndex = i;
      break;
    }
  }

  if (introStartIndex === -1) {
    return text;
  }

  const resultLines: string[] = [];
  for (let i = 0; i < introStartIndex; i++) {
    resultLines.push(lines[i]);
  }

  let foundNextHeader = false;
  for (let i = introStartIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!foundNextHeader) {
      if (/^(#|##|###)\s+/.test(trimmed)) {
        foundNextHeader = true;
        resultLines.push(line);
      }
      continue;
    }

    resultLines.push(line);
  }

  return resultLines.join('\n').trim();
}

/**
 * Parses content buffer into separate chapters based on markdown headers.
 */
export function parseChapters(text: string): Chapter[] {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let currentTitle = 'Introduction';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(##|###)\s+(.+)$/);
    if (headerMatch) {
      const contentStr = currentContent.join('\n').trim();
      if (contentStr || chapters.length > 0) {
        chapters.push({ title: currentTitle, content: contentStr || 'No content.' });
      }
      currentTitle = headerMatch[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  const contentStr = currentContent.join('\n').trim();
  chapters.push({ title: currentTitle, content: contentStr || 'No content.' });

  // Fallback to chunking if no markdown headers are present in a long response
  if (chapters.length === 1 && chapters[0].title === 'Introduction' && chapters[0].content.length > 1500) {
    const rawText = chapters[0].content;
    const splitChapters: Chapter[] = [];
    let startIndex = 0;
    let chapNum = 1;
    while (startIndex < rawText.length) {
      let endIndex = startIndex + 1500;
      if (endIndex < rawText.length) {
        const searchArea = rawText.substring(endIndex - 100, endIndex + 50);
        const spaceOffset = Math.max(searchArea.lastIndexOf('\n'), searchArea.lastIndexOf(' '));
        if (spaceOffset !== -1) {
          endIndex = (endIndex - 100) + spaceOffset;
        }
      }
      const chunk = rawText.substring(startIndex, endIndex).trim();
      if (chunk) {
        splitChapters.push({
          title: `Section ${chapNum++}`,
          content: chunk
        });
      }
      startIndex = endIndex;
    }
    return splitChapters;
  }

  // Ensure select menu titles do not exceed Discord's 100-character limit
  return chapters.map(ch => ({
    title: ch.title.length > 95 ? ch.title.substring(0, 92) + '...' : ch.title,
    content: ch.content
  }));
}
