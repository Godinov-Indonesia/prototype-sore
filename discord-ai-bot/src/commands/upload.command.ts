import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ApiService } from '../services/api.service';
import { Command } from '../types/discord.types';
import { StreamService } from '../services/stream.service';

const uploadCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload a meeting transkript/document and instruct the AI Agent')
    .addAttachmentOption(option => 
      option.setName('file')
        .setDescription('Upload document (.txt, .docx, .pdf)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('prompt')
        .setDescription('Context or instruction (e.g. Tolong rangkum rapat ini)')
        .setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const fileOption = interaction.options.getAttachment('file', true);
    const prompt = interaction.options.getString('prompt', true);

    // Fail-safe file validation (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (fileOption.size > MAX_SIZE) {
      const sizeMb = (fileOption.size / (1024 * 1024)).toFixed(2);
      await interaction.editReply({
        content: `❌ **File Size Limit Exceeded**: Your file is **${sizeMb}MB**. The maximum allowed size is **10MB**.`
      });
      return;
    }

    // Mime-types / Extension validation
    const allowedExtensions = ['.txt', '.docx', '.pdf'];
    const fileName = fileOption.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExt) {
      await interaction.editReply({
        content: `❌ **Invalid File Format**: Only text files, PDF, or DOCX are supported (${allowedExtensions.join(', ')}).`
      });
      return;
    }

    try {
      // Download the attachment into a Buffer
      const downloadResponse = await fetch(fileOption.url);
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download attachment: ${downloadResponse.statusText}`);
      }
      const arrayBuffer = await downloadResponse.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Submit to NestJS agent runner
      const result = await ApiService.runAgent(prompt, fileBuffer, fileOption.name);

      const message = await interaction.editReply({ content: '🤖 *Formatting output...*' });
      await StreamService.renderResponse(result.answer, prompt, message, {
        steps: result.steps
      });

    } catch (error: any) {
      console.error('Error running agent with attachment:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF3366)
        .setTitle('❌ Agent Run Failed')
        .setDescription(`An error occurred during agent processing:\n\`\`\`${error.message || error}\`\`\``)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

export default uploadCommand;
