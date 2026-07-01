export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  startIndex: number;
  endIndex: number;
  rawText: string;
}

/**
 * Extracts markdown tables from text
 */
export function extractTables(text: string): ParsedTable[] {
  const lines = text.split('\n');
  const tables: ParsedTable[] = [];
  let inTable = false;
  let currentTableLines: { line: string; index: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // A table row starts with | and ends with |
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|');

    if (isTableRow) {
      inTable = true;
      currentTableLines.push({ line: trimmed, index: i });
    } else {
      if (inTable) {
        if (currentTableLines.length >= 3) {
          const sepLine = currentTableLines[1].line;
          if (/^\|[\s:-|]+$/.test(sepLine)) {
            const headers = currentTableLines[0].line
              .split('|')
              .slice(1, -1)
              .map(h => h.trim());
            const rows = currentTableLines.slice(2).map(item =>
              item.line
                .split('|')
                .slice(1, -1)
                .map(c => c.trim())
            );
            tables.push({
              headers,
              rows,
              startIndex: currentTableLines[0].index,
              endIndex: currentTableLines[currentTableLines.length - 1].index,
              rawText: currentTableLines.map(l => l.line).join('\n')
            });
          }
        }
        inTable = false;
        currentTableLines = [];
      }
    }
  }

  if (inTable && currentTableLines.length >= 3) {
    const sepLine = currentTableLines[1].line;
    if (/^\|[\s:-|]+$/.test(sepLine)) {
      const headers = currentTableLines[0].line
        .split('|')
        .slice(1, -1)
        .map(h => h.trim());
      const rows = currentTableLines.slice(2).map(item =>
        item.line
          .split('|')
          .slice(1, -1)
          .map(c => c.trim())
      );
      tables.push({
        headers,
        rows,
        startIndex: currentTableLines[0].index,
        endIndex: currentTableLines[currentTableLines.length - 1].index,
        rawText: currentTableLines.map(l => l.line).join('\n')
      });
    }
  }

  return tables;
}

/**
 * Formats table rows for participant-like lists using blockquotes and emojis
 */
function formatParticipantTable(table: ParsedTable): string {
  return table.rows
    .map(row => {
      const name = row[0] || '';
      const role = row[1] || '';
      if (role) {
        return `> 👤 **${name}** — ${role}`;
      }
      return `> 👤 **${name}**`;
    })
    .join('\n');
}

/**
 * Formats a general table as clean bullet points
 */
function formatGeneralTable(table: ParsedTable): string {
  return table.rows
    .map(row => {
      const key = row[0] || '';
      const rest = row.slice(1).filter(Boolean).join(' — ');
      if (rest) {
        return `• **${key}**: ${rest}`;
      }
      return `• ${key}`;
    })
    .join('\n');
}

/**
 * Parses markdown tables from raw text and returns clean text + fields
 */
export function cleanMarkdownTables(rawText: string): { text: string; fields: EmbedField[] } {
  const tables = extractTables(rawText);
  let processedText = rawText;
  const fields: EmbedField[] = [];

  // Sort descending by startIndex to replace without messing up offsets
  tables.sort((a, b) => b.startIndex - a.startIndex);

  for (const table of tables) {
    const isParticipant = table.headers.some(h => 
      /peserta|nama|hadir|member|participant|user|people|person/i.test(h)
    );
    const isMetrics = table.headers.some(h => 
      /kinerja|operasional|target|pencapaian|nilai|skor|region|lokasi|persentase|metric|value|status/i.test(h)
    );

    if (isMetrics) {
      // Add inline fields
      table.rows.forEach(row => {
        const label = row[0] || 'Metric';
        const value = row[1] || '-';
        fields.push({
          name: `📍 ${label}`,
          value: `**${value}**`,
          inline: true
        });
      });
      // Remove table raw text
      processedText = processedText.replace(table.rawText, '');
    } else if (isParticipant) {
      const formatted = formatParticipantTable(table);
      processedText = processedText.replace(table.rawText, formatted);
    } else {
      const formatted = formatGeneralTable(table);
      processedText = processedText.replace(table.rawText, formatted);
    }
  }

  // Clean extra newlines from replacement
  processedText = processedText.replace(/\n{3,}/g, '\n\n').trim();

  return { text: processedText, fields };
}
