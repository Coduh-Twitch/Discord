import { ApplicationCommandOptionType, ComponentType, LabelBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { ensureOrUpdateStickyMessage, getChannelStickyMessage } from "../db/guilds";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { buildStickyMessage } from "../utils/utils";

const StickyCommand: Command = {
  enabled: true,
  name: "sticky",
  description: "Manage sticky messages for the current channel",
  defaultMemberPermissions: [PermissionFlagsBits.PinMessages],
  category: CommandCategory.MOD,
  options: [
    {
      name: "set",
      description: "Create or edit a sticky message for the current channel",
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: "remove",
      description: "Delete the sticky message for the current channel",
      type: ApplicationCommandOptionType.Subcommand
    }
  ],
  run: async interaction => {
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case "set": {
        const channel = interaction.channel;
        const dbStickyMessage = getChannelStickyMessage(channel.id);
        let existingContent = dbStickyMessage?.content || null;

        const modal = new ModalBuilder().setCustomId(`sticky-${interaction.id}`).setTitle(`${dbStickyMessage ? "Update" : "New"} Sticky Message`);
        const input = new TextInputBuilder().setCustomId("sticky-content").setStyle(TextInputStyle.Paragraph)
        if (existingContent) input.setValue(existingContent);

        const label = new LabelBuilder().setLabel("label").setDescription("description");
        label.setTextInputComponent(input);
        modal.addLabelComponents([label]);

        await interaction.showModal(modal);
        let submission: ModalSubmitInteraction | null = null;
        submission = await interaction.awaitModalSubmit({ time: 600e3 }).catch(() => submission = null);

        await interaction.followUp({flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [TMComponentBuilder.textDisplay(`Follow the instructions in the popup to set the sticky message...`)], withResponse: true})

        if (!submission) {
          await interaction.followUp({flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [TMComponentBuilder.errorContainer(false).buildContainer()]})
        } else {
          const value = submission.fields.getTextInputValue("sticky-content");

          await submission.reply({ flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [TMComponentBuilder.textDisplay(`Sticky message ${dbStickyMessage ? "updated" : "created"}!`)] })
          const newDbStickyMessage = ensureOrUpdateStickyMessage({ guild_id: interaction.guildId, channel_id: interaction.channelId, content: value });
          const components = buildStickyMessage(newDbStickyMessage);

          interaction.channel.send({ flags: [MessageFlags.IsComponentsV2], allowedMentions: {roles: [], users: []}, components }).then(async m => {
            const oldMessage = dbStickyMessage ? await interaction.channel.messages.fetch(dbStickyMessage.message_id) : null;
            if (oldMessage && oldMessage.deletable) await oldMessage.delete();
            ensureOrUpdateStickyMessage({ ...newDbStickyMessage, message_id: m.id });
          }).catch(e => {

          })
        }
        break;
      }

      case "remove": {

        break;
      }
    }
  }
}

export default StickyCommand;
