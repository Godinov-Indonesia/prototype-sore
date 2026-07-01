import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/discord.types';
import { SessionService } from '../services/session.service';
import { StreamService } from '../services/stream.service';

const chatCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Ask the AI Assistant a question')
    .addStringOption(option =>
      option
        .setName('prompt')
        .setDescription('Type your question or instruction for the AI')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const prompt = interaction.options.getString('prompt', true);
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Immediately defer response to avoid timeout
    await interaction.deferReply();

    try {
      // Retrieve existing or instantiate new session
      const sessionId = await SessionService.getOrCreateSession(userId, username);

      const message = await interaction.editReply({
        content: '🤖 *Thinking...*',
        embeds: []
      });

      // Start streaming directly to the message object
      await StreamService.streamChat(sessionId, prompt, message);
    } catch (error: any) {
      console.error('Error in chat command execution:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF3366)
        .setTitle('❌ AI Stream Request Failed')
        .setDescription(`An error occurred while processing your message:\n\`\`\`${error.message || error}\`\`\``)
        .setTimestamp();

      await interaction.editReply({
        content: '',
        embeds: [errorEmbed]
      });
    }
  }
};

export default chatCommand;
