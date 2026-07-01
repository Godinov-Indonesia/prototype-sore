import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  EmbedBuilder,
  Message
} from 'discord.js';
import { Chapter } from '../utils/chapter.parser';
import { RenderOptions } from '../services/stream.service';

export function createWorkspaceEmbed(
  chapters: Chapter[], 
  cleanPrompt: string, 
  activeMessage: Message, 
  options?: RenderOptions
): EmbedBuilder {
  const introEmbed = new EmbedBuilder()
    .setColor(0x00A2FF)
    .setTitle('📋 Document Workspace')
    .setDescription(`*Your requested document has been compiled successfully. Use the dropdown below to read specific chapters or export the full file.*`)
    .addFields(
      { name: 'Document Title', value: cleanPrompt || 'AI Response Document' },
      { name: 'Chapters Available', value: chapters.map((c, i) => `${i + 1}. **${c.title}**`).join('\n') || 'None' }
    )
    .setTimestamp()
    .setFooter({ text: 'Notion Workspace System', iconURL: activeMessage.client.user?.displayAvatarURL() });

  if (options?.steps && options.steps.length > 0) {
    const stepDetails = options.steps.map((step: any, idx: number) => `${idx + 1}. **${step.toolName}**`).join('\n');
    introEmbed.addFields({ name: 'Automated Steps Executed', value: stepDetails });
  }

  if (options?.references && options.references.length > 0) {
    const refDetails = options.references.map((ref: any, idx: number) => {
      const scoreStr = ref.score ? ` (Score: ${(ref.score * 100).toFixed(1)}%)` : '';
      return `${idx + 1}. Doc: \`${ref.documentId || 'Unknown'}\` Index: ${ref.chunkIndex ?? 'N/A'}${scoreStr}\n*Snippet*: ${ref.textSnippet || ''}`;
    }).join('\n\n');
    introEmbed.addFields({ name: 'References Context', value: refDetails.length > 1024 ? refDetails.substring(0, 1020) + '...' : refDetails });
  }

  return introEmbed;
}

export function createWorkspaceComponents(chapters: Chapter[]): {
  selectRow: ActionRowBuilder<StringSelectMenuBuilder>;
  exportRow: ActionRowBuilder<ButtonBuilder>;
} {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('doc_chapter_select')
    .setPlaceholder('📖 Choose a chapter to read...')
    .addOptions(
      chapters.map((ch, idx) => ({
        label: ch.title,
        description: `Read ${ch.title}`,
        value: idx.toString()
      }))
    );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const exportRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('export_pdf_button')
      .setLabel('Export PDF')
      .setEmoji('📥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('export_docx_button')
      .setLabel('Export DOCX')
      .setEmoji('📑')
      .setStyle(ButtonStyle.Secondary)
  );

  return { selectRow, exportRow };
}
