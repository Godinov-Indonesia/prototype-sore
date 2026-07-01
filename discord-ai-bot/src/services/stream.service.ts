import { 
  Message, 
  EmbedBuilder, 
  ComponentType
} from 'discord.js';
import { cleanMarkdownTables } from '../utils/table-parser';
import { parseChapters } from '../utils/chapter.parser';
import { exportToPDF, exportToDOCX } from '../utils/exporter.util';
import { createWorkspaceEmbed, createWorkspaceComponents } from '../components/workspace.component';

interface SseMessage {
  event: string;
  data: any;
}

export interface CachedDoc {
  content: string;
  prompt: string;
  steps?: any[];
  references?: any[];
  timestamp: number;
}

export interface RenderOptions {
  steps?: { toolName: string }[];
  references?: { documentId?: string; chunkIndex?: number; score?: number; textSnippet?: string }[];
}

export class StreamService {
  public static documentCache = new Map<string, CachedDoc>();

  private static getBaseUrl(): string {
    const url = process.env.API_BASE_URL || 'http://localhost:3000/api';
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /**
   * Universally renders a response (under 1200 chars -> standard embed, over 1200 -> Notion workspace)
   */
  public static async renderResponse(
    contentBuffer: string,
    prompt: string,
    activeMessage: Message,
    options?: RenderOptions
  ): Promise<void> {
    const promptPrefix = `👤 **User Prompt:** *"${prompt}"*\n---\n🤖 **Company AI Assistant**:\n`;

    // Pre-process and truncate references if present
    let referencesLength = 0;
    if (options?.references && options.references.length > 0) {
      options.references.forEach((ref: any) => {
        const snippet = ref.textSnippet || '';
        if (snippet.length > 150) {
          ref.textSnippet = snippet.substring(0, 150) + '... [truncated]';
        }
      });

      const refDetails = options.references.map((ref: any, idx: number) => {
        const scoreStr = ref.score ? ` (Score: ${(ref.score * 100).toFixed(1)}%)` : '';
        return `${idx + 1}. Doc: \`${ref.documentId || 'Unknown'}\` Index: ${ref.chunkIndex ?? 'N/A'}${scoreStr}\n*Snippet*: ${ref.textSnippet || ''}`;
      }).join('\n\n');
      referencesLength = refDetails.length;
    }

    const totalLength = contentBuffer.length + referencesLength;

    if (totalLength < 1200) {
      const { text: processedText } = cleanMarkdownTables(contentBuffer);
      const embed = new EmbedBuilder()
        .setColor(0x00A2FF)
        .setDescription(processedText || '🤖 *No response content received.*')
        .setTimestamp()
        .setFooter({ text: 'AI Assistant', iconURL: activeMessage.client.user?.displayAvatarURL() });

      // Add steps if present
      if (options?.steps && options.steps.length > 0) {
        const stepDetails = options.steps.map((step: any, idx: number) => `${idx + 1}. **${step.toolName}**`).join('\n');
        embed.addFields({ name: 'Automated Steps Executed', value: stepDetails });
      }

      // Add references if present
      if (options?.references && options.references.length > 0) {
        const refDetails = options.references.map((ref: any, idx: number) => {
          const scoreStr = ref.score ? ` (Score: ${(ref.score * 100).toFixed(1)}%)` : '';
          return `${idx + 1}. Doc: \`${ref.documentId || 'Unknown'}\` Index: ${ref.chunkIndex ?? 'N/A'}${scoreStr}\n*Snippet*: ${ref.textSnippet || ''}`;
        }).join('\n\n');
        embed.addFields({ name: 'References Context', value: refDetails.length > 1024 ? refDetails.substring(0, 1020) + '...' : refDetails });
      }

      await activeMessage.edit({
        content: `👤 **User Prompt:** *"${prompt}"*\n---\n🤖 **Company AI Assistant**:`,
        embeds: [embed],
        components: []
      });
      return;
    }

    // Over 1200 chars (The Document Workspace)
    const chapters = parseChapters(contentBuffer);
    const cleanPrompt = prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt;

    // Cache the document text and metadata
    StreamService.documentCache.set(activeMessage.id, {
      content: contentBuffer,
      prompt,
      steps: options?.steps,
      references: options?.references,
      timestamp: Date.now()
    });

    // Clean up old entries (older than 2 hours)
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [key, val] of StreamService.documentCache.entries()) {
      if (now - val.timestamp > TWO_HOURS) {
        StreamService.documentCache.delete(key);
      }
    }

    // Delegate creation of Embed and Buttons to modules
    const introEmbed = createWorkspaceEmbed(chapters, cleanPrompt, activeMessage, options);
    const { selectRow, exportRow } = createWorkspaceComponents(chapters);

    try {
      const introContent = `👤 **User Prompt:** *"${prompt}"*\n---\n🤖 **Company AI Assistant**:\n`;
      await activeMessage.edit({
        content: introContent,
        embeds: [introEmbed],
        components: [selectRow, exportRow]
      });

      // Start Interaction Collector
      const collector = activeMessage.createMessageComponentCollector({
        time: 3600000 // 1 hour collector
      });

      collector.on('collect', async (interaction) => {
        try {
          // Immediately defer based on interaction type to prevent 3-second timeout
          if (interaction.isButton()) {
            await interaction.deferReply({ flags: ['Ephemeral'] });
          } else if (interaction.isStringSelectMenu()) {
            await interaction.deferUpdate();
          }

          if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'doc_chapter_select') {
              const selectedIdx = parseInt(interaction.values[0], 10);
              const selectedChapter = chapters[selectedIdx];

              if (selectedChapter) {
                const { text: cleanedChapterText } = cleanMarkdownTables(selectedChapter.content);
                let displayText = cleanedChapterText;

                if (displayText.length > 1900) {
                  displayText = displayText.substring(0, 1850) + '\n\n... (Content truncated due to Discord length limits. Please download the full PDF/DOCX to view the entire section.)';
                }

                const chapterEmbed = new EmbedBuilder()
                  .setColor(0x00A2FF)
                  .setTitle(`📖 ${selectedChapter.title}`)
                  .setDescription(displayText || '*No content in this chapter.*')
                  .setTimestamp()
                  .setFooter({ text: `Chapter ${selectedIdx + 1} of ${chapters.length} • AI Assistant`, iconURL: activeMessage.client.user?.displayAvatarURL() });

                await interaction.editReply({
                  embeds: [chapterEmbed]
                });
              }
            }
          } else if (interaction.isButton()) {
            try {
              const authorName = interaction.user.username;
              const docTitle = 'AI Response Document';

              if (interaction.customId === 'export_pdf_button') {
                const pdfBuffer = await exportToPDF(docTitle, authorName, contentBuffer);
                await interaction.editReply({
                  content: '✅ **PDF exported successfully!**',
                  files: [{
                    attachment: pdfBuffer,
                    name: 'document.pdf'
                  }]
                });
              } else if (interaction.customId === 'export_docx_button') {
                const docxBuffer = await exportToDOCX(docTitle, authorName, contentBuffer);
                await interaction.editReply({
                  content: '✅ **DOCX exported successfully!**',
                  files: [{
                    attachment: docxBuffer,
                    name: 'document.docx'
                  }]
                });
              }
            } catch (err: any) {
              console.error('Export error:', err);
              await interaction.editReply({
                content: `❌ **Failed to export document**: ${err.message || err}`
              });
            }
          }
        } catch (collectorErr: any) {
          console.error('Error handling collected interaction:', collectorErr.message || collectorErr);
        }
      });

    } catch (discordError: any) {
      console.error('Failed to set up Notion-Style interface:', discordError.message);
    }
  }

  /**
   * Connects to GET /api/chats/:id/messages/stream and handles SSE updates
   * with rate-limiting throttling for Discord messages.
   */
  public static async streamChat(
    sessionId: string,
    content: string,
    messageToEdit: Message
  ): Promise<void> {
    const url = `${this.getBaseUrl()}/chats/${sessionId}/messages/stream?content=${encodeURIComponent(content)}`;
    let activeMessage = messageToEdit;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to establish stream connection: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null, cannot read stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      let contentBuffer = '';
      let isDone = false;
      
      // Throttle configuration
      const THROTTLE_MS = 1500;
      let lastUpdate = 0;
      let lastEditedText = '';
      let updatePending = false;
      let updateTimeout: NodeJS.Timeout | null = null;

      const promptPrefix = `👤 **User Prompt:** *"${content}"*\n---\n🤖 **Company AI Assistant**:\n`;

      const triggerMessageUpdate = async (force = false) => {
        const now = Date.now();
        
        // If not forced and we're within the throttle window, schedule a deferred update
        if (!force && now - lastUpdate < THROTTLE_MS) {
          if (!updatePending) {
            updatePending = true;
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
              updatePending = false;
              triggerMessageUpdate(false);
            }, THROTTLE_MS - (now - lastUpdate));
          }
          return;
        }

        // Cancel any pending deferred updates since we are updating now
        if (updateTimeout) {
          clearTimeout(updateTimeout);
          updateTimeout = null;
        }
        updatePending = false;
        lastUpdate = now;

        if (isDone) {
          await this.renderResponse(contentBuffer, content, activeMessage);
          return;
        }

        // During streaming (isDone is false)
        let text = contentBuffer;
        if (!text) {
          // Keep the initial "Thinking..." message, don't edit yet
          return;
        }

        // Clip text dynamically to ensure the final message doesn't exceed 2,000 characters
        const maxAllowedLength = 1950 - promptPrefix.length;
        if (text.length > maxAllowedLength) {
          text = text.substring(0, Math.max(0, maxAllowedLength - 40)) + '... (truncated, writing file...)';
        }

        const formattedContent = promptPrefix + text;

        if (formattedContent && formattedContent !== lastEditedText) {
          try {
            await activeMessage.edit({ content: formattedContent });
            lastEditedText = formattedContent;
          } catch (discordError: any) {
            console.error('Failed to edit Discord message chunk:', discordError.message);
          }
        }
      };

      // Helper function to process complete SSE events
      const handleSseMessage = async (msg: SseMessage) => {
        switch (msg.event) {
          case 'thinking':
            // Ignore thinking process completely to prevent cluttering the interface and wasting character limits
            break;
          case 'content':
            if (msg.data && msg.data.chunk) {
              contentBuffer += msg.data.chunk;
              await triggerMessageUpdate();
            }
            break;
          case 'status':
            if (msg.data && msg.data.status === 'done') {
              isDone = true;
              await triggerMessageUpdate(true);
            }
            break;
          case 'error':
            throw new Error(msg.data?.message || 'Unknown backend AI error');
        }
      };

      // Read from network stream
      let currentEvent = 'message'; // NestJS default SSE event name is 'message' if not overridden
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode(); // Flush any remaining bytes
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // SSE messages are separated by double newlines (\n\n or \r\n\r\n)
        const normalizedBuffer = buffer.replace(/\r\n/g, '\n');
        const blocks = normalizedBuffer.split('\n\n');
        
        // Save the incomplete last block back to the buffer
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split('\n');
          let eventName = currentEvent;
          let dataBuffer = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              eventName = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              dataBuffer += (dataBuffer ? '\n' : '') + trimmed.substring(5).trim();
            }
          }

          if (dataBuffer) {
            currentEvent = eventName;
            try {
              const dataObj = JSON.parse(dataBuffer);
              await handleSseMessage({ event: eventName, data: dataObj });
            } catch (err) {
              // If it's not JSON, pass the raw string/buffer
              await handleSseMessage({ event: eventName, data: dataBuffer });
            }
          }
        }
      }

      // Handle any remaining content left in buffer
      if (buffer.trim()) {
        const normalizedBuffer = buffer.replace(/\r\n/g, '\n');
        const blocks = normalizedBuffer.split('\n\n');
        for (const block of blocks) {
          const lines = block.split('\n');
          let eventName = currentEvent;
          let dataBuffer = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              eventName = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              dataBuffer += (dataBuffer ? '\n' : '') + trimmed.substring(5).trim();
            }
          }

          if (dataBuffer) {
            try {
              const dataObj = JSON.parse(dataBuffer);
              await handleSseMessage({ event: eventName, data: dataObj });
            } catch {
              await handleSseMessage({ event: eventName, data: dataBuffer });
            }
          }
        }
      }

      // Final forced message update to ensure all text is flushed
      isDone = true;
      await triggerMessageUpdate(true);

    } catch (error: any) {
      console.error('SSE Stream subscription error:', error);
      try {
        await activeMessage.edit({
          content: `❌ **Error while streaming response:** ${error.message || 'An unexpected error occurred.'}`
        });
      } catch (discordError) {
        console.error('Failed to send final error message to channel:', discordError);
      }
      throw error;
    }
  }
}
