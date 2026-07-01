import { Events, Interaction, EmbedBuilder } from 'discord.js';
import { ExtendedClient, CustomIds } from '../types/discord.types';
import { StreamService } from '../services/stream.service';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    const client = interaction.client as ExtendedClient;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing /${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
    } else if (interaction.isButton()) {
      console.log(`Received Button interaction: ${interaction.customId}`);
      // TODO: Delegate to button interaction registry
    } else if (interaction.isModalSubmit()) {
      console.log(`Received Modal interaction: ${interaction.customId}`);
      if (interaction.customId === CustomIds.QUERY_MODAL) {
        const { handleRagQueryModal } = require('../interactions/modals/rag-query.modal');
        await handleRagQueryModal(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      console.log(`Received StringSelectMenu interaction: ${interaction.customId}`);
      // TODO: Delegate to select menu interaction registry
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(`Error executing autocomplete for /${interaction.commandName}:`, error);
        }
      }
    }
  },
};
