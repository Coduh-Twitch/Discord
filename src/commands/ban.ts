import { ApplicationCommandOptionType, ButtonInteraction, ButtonStyle, Colors, Component, ComponentType, MessageFlags, PermissionFlagsBits, TextChannel, userMention } from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command"
import config from "../config"
import { dev_mode, logContainer } from "..";
import { TMComponentBuilder } from "../classes/ComponentBuilder"

const BanCommand: Command = {
    enabled: true,
    name: "ban",
    description: "Ban a member from the server",
    category: CommandCategory.MOD,
    requiredRole: UserLevel.MOD,
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
    options: [
        {
            name: "user",
            description: "The user to ban",
            type: ApplicationCommandOptionType.User,
            required: true
        },
        {
            name: "reason",
            description: "The reason you are banning them",
            type: ApplicationCommandOptionType.String,
            min_length: 1,
            max_length: 512,
            required: true
        }
    ],
    run: async (interaction) => {
        let flags: MessageFlags[] = dev_mode ? [] : [MessageFlags.Ephemeral];

        let res = await interaction.deferReply({ flags: flags as any, withResponse: true });

        let user = interaction.options.getUser("user", true);
        let reason = interaction.options.getString("reason", true);
        let expirationTime = 60e3;

        let confirmCont = new TMComponentBuilder();
        confirmCont.setAccentColor(Colors.Yellow);
        confirmCont.addTextDisplay(`## Are you Sure?\nAre you sure you want to ban ${userMention(user.id)} \`${user.id}\`?\n### Reason\n\`\`\`${reason}\`\`\``)
        confirmCont.addSeparator();
        confirmCont.addTextDisplay('-# Confirm?')
        confirmCont.addButtonActionRow([
            TMComponentBuilder.accessoryButton(ButtonStyle.Danger, `Ban @${user.username}`, null, null, { action: "confirm", interactionId: interaction.id }),
            TMComponentBuilder.accessoryButton(ButtonStyle.Secondary, `Cancel`, null, null, { action: "cancel", interactionId: interaction.id })
        ]);
        confirmCont.addTextDisplay(`-# This interaction expires <t:${Math.floor((expirationTime + Date.now()) / 1000)}:R>`)

        await interaction.editReply({ flags: [MessageFlags.IsComponentsV2], components: [confirmCont.buildContainer()] });

        let button: ButtonInteraction | null;
        button = await res.resource.message.awaitMessageComponent({ componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, time: expirationTime }).catch(() => button = null);

        if (!button) {
            let expired = new TMComponentBuilder();
            expired.setAccentColor(Colors.Red);
            expired.addTextDisplay(`## Interaction Expired\n-# This interaction expired <t:${Math.floor(Date.now() / 1000)}:R>`)

            await interaction.editReply({ components: [expired.buildContainer()] })
        } else {
            await button.deferUpdate();

            if (button.customId.includes("confirm")) {
                let banned = new TMComponentBuilder();
                banned.setAccentColor(Colors.Green);
                banned.addTextDisplay(`## User Banned\n-# Successfully banned **@${user.username}** *(${user.id})* <t:${Math.floor(Date.now() / 1000)}:R>\n### Reason\n\`\`\`${reason}\`\`\``)

                interaction.guild.bans.create(user.id, {deleteMessageSeconds: 604800, reason}).then(async () => {
                    await interaction.editReply({ components: [banned.buildContainer()] })
                    let logsChannel = interaction.guild.channels.cache.get(config.channels.logs) as TextChannel;
                    logsChannel.send({flags: [MessageFlags.IsComponentsV2], components: [logContainer("User Banned", `${userMention(interaction.user.id)} banned **@${user.username}** *(${user.id})*\n### Reason\n\`\`\`${reason}\`\`\``, "DANGER").buildContainer()]});
                }).catch(async e => {
                    let failed = new TMComponentBuilder();
                    failed.setAccentColor(Colors.Red);
                    failed.addTextDisplay(`## Ban Failed\n-# Failed to ban **@${user.username}** *(${user.id})* <t:${Math.floor(Date.now() / 1000)}:R>${e?.message ? `\n\n\`\`\`${e.message}\`\`\`` : ""}`)

                    await interaction.editReply({ components: [failed.buildContainer()] })
                })
            }

            if (button.customId.includes("cancel")) {
                let cancelled = new TMComponentBuilder();
                cancelled.setAccentColor(Colors.Red);
                cancelled.addTextDisplay(`## Ban Cancelled\n-# Action cancelled <t:${Math.floor(Date.now() / 1000)}:R>`)

                await interaction.editReply({ components: [cancelled.buildContainer()] })
            }
        }
    }
}

export default BanCommand;