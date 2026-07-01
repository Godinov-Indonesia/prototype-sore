import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/discord.types';
import { ApiService } from '../services/api.service';
import { StreamService } from '../services/stream.service';

const queryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('query')
    .setDescription('Perform semantic search against company knowledge base (RAG)')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Enter search criteria or question...')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = interaction.options.getString('query', true);

    await interaction.deferReply();

    try {
      const result = await ApiService.queryRag(query);

      // Aggressive snippet slicing to 150 characters
      const refs = result.references || [];
      const formattedReferences = refs.map((ref: any, idx: number) => {
        const scoreStr = ref.score ? ` (Score: ${(ref.score * 100).toFixed(1)}%)` : '';
        const snippetText = ref.textSnippet || '';
        const slicedSnippet = snippetText.length > 150 ? snippetText.substring(0, 150) + '... [truncated]' : snippetText;
        return `${idx + 1}. Doc: \`${ref.documentId || 'Unknown'}\` Index: ${ref.chunkIndex ?? 'N/A'}${scoreStr}\n*Snippet*: ${slicedSnippet}`;
      }).join('\n\n');

      const totalOutput = result.answer + '\n\n' + formattedReferences;
      const message = await interaction.editReply({ content: '🤖 *Formatting output...*' });

      if (totalOutput.length >= 1200) {
        // Force structural chapters for workspace. Do not pass references in options to prevent leakage to introEmbed.
        const structuredPayload = `## Bab 1: Answer\n${result.answer}\n\n## Bab 2: References Context\n${formattedReferences}`;
        await StreamService.renderResponse(structuredPayload, query, message);
      } else {
        await StreamService.renderResponse(result.answer, query, message, {
          references: refs
        });
      }
    } catch (error: any) {
      console.error('Error executing semantic query:', error);
      const errorEmbed = new (require('discord.js').EmbedBuilder)()
        .setColor(0xFF3366)
        .setTitle('❌ Knowledge Query Failed')
        .setDescription(`An error occurred during semantic search:\n\`\`\`${error.message || error}\`\`\``)
        .setTimestamp();

      await interaction.editReply({ content: '', embeds: [errorEmbed] });
    }
  }
};

export default queryCommand;
