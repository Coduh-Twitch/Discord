import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonInteraction, ButtonStyle, channelMention, ChannelType, Colors, ComponentType, formatEmoji, MessageFlags, parseEmoji, PermissionFlagsBits, roleMention, SeparatorSpacingSize, TextChannel, userMention } from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command"
import { TMComponentBuilder } from "../classes/ComponentBuilder"
import config from "../config"
import { dev_mode } from "..";
import { userModel } from "../models/user";
import os from "node:os"

const DevCommand: Command = {
    enabled: true,
    category: CommandCategory.DEV,
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    name: "dev",
    description: "Developer-Only commands",
    options: [
        {
            name: "read-config",
            description: "Display config values for verification",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.DEV,
        },
        {
            name: "reset-users",
            description: "Reset all user DB values to defaults (DANGEROUS)",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.DEV,
        },
        {
            name: "role-react",
            description: "Send a reaction role message to the specified channel",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.DEV,
            options: [
                {
                    name: "role",
                    description: "The role to react for",
                    type: ApplicationCommandOptionType.Role,
                    required: true,
                },
                {
                    name: "emoji",
                    description: "The emoji or emoji ID associated with the role",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: "channel",
                    description: "The channel to send this reaction role to. Defaults to the current channel.",
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice],
                    required: false,
                },
            ]
        }
    ],
    run: async (interaction) => {
        let subcommand = interaction.options.getSubcommand(true);
        let res = await interaction.deferReply({ flags: [MessageFlags.Ephemeral], withResponse: true });

        if (subcommand === "reset-users") {
            if(os.hostname() !== "ducky") return interaction.editReply({content: `You can't do that in the current environment`})
            let expirationTime = 60e3;
            let expirationDate = Date.now() + expirationTime;
            let expirationTimestamp = Math.floor(expirationDate / 1000);

            let pass = true;
            if (!pass) return;

            let sendButton = TMComponentBuilder.accessoryButton(ButtonStyle.Danger, `Reset`, null, null, { action: "reset", interactionId: interaction.id })

            let container = new TMComponentBuilder();
            container.addTextDisplay(`## Reset All DB Users?`);
            container.addTextDisplay(`This is a dangerous action. Dismiss this interaction to cancel. - Interaction expires <t:${expirationTimestamp}:R>`);
            
            let actionRow = new ActionRowBuilder<ButtonBuilder>();
            actionRow.setComponents([sendButton]);
            interaction.editReply({ components: [container.buildContainer(), actionRow], flags: [MessageFlags.IsComponentsV2] })

            let int: ButtonInteraction | null;
            int = await res.resource.message.awaitMessageComponent({componentType: ComponentType.Button, filter: i => i.customId.includes("reset"), time: expirationTime}).catch(e => int = null);

            if(!int) {
                interaction.editReply({components: [new TMComponentBuilder().addTextDisplay(`The interaction has expired.`).buildContainer()]})
            } else if(int.customId.includes("reset")) {
                await int.deferUpdate();
                let users = await userModel.find();

                for(const user of users) {
                    let movies = user.favorite_movies;
                    if(movies.includes("564638")) {movies = ["564638"];} else {movies = []}
                    await user.updateOne({points: 0, xp: 0, level: 0, shownWelcomeMessage: true, messages: 0, favorite_movies: movies}).exec();
                }

                await interaction.editReply({components: [new TMComponentBuilder().setAccentColor(Colors.Green).addTextDisplay(`Reset ${users.length.toLocaleString()} users(s)`).buildContainer()]})
            }
        }

        if (subcommand === "role-react") {
            let expirationTime = 60e3;
            let expirationDate = Date.now() + expirationTime;
            let expirationTimestamp = Math.floor(expirationDate / 1000);

            let role = interaction.options.getRole("role", true);
            let emoji = interaction.options.getString("emoji", true);
            let channel = (interaction.options.getChannel("channel", false) || interaction.channel) as TextChannel;

            let pass = true;

            Object.entries(config.roles.levels).forEach(([k, v]) => {
                if (v === role.id) {
                    pass = false;
                    return interaction.editReply({ content: `Can not use role "${role.name}" as it is a level role (${k})` });
                }
            })

            let fullRole = interaction.guild.roles.cache.get(role.id);

            if (pass && fullRole.permissions.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageEvents, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ViewAuditLog], true)) return interaction.editReply({ content: `Can not use role "${role.name}" as it has one or more dangerous permissions` })

            if (!pass) return;

            let emojiIsId = !Number.isNaN(Number(emoji));
            let formattedEmoji = emojiIsId ? formatEmoji(emoji) : emoji;

            let button = TMComponentBuilder.accessoryButton(ButtonStyle.Primary, `@${role.name}`, null, parseEmoji(formattedEmoji) ? parseEmoji(formattedEmoji) : null, { action: `role-react-${role.id}`, interactionId: interaction.id })
            let sendButton = TMComponentBuilder.accessoryButton(ButtonStyle.Success, `${channel.name}`, null, null, { action: "send", interactionId: interaction.id })

            let container = new TMComponentBuilder();
            container.addTextDisplay(`${roleMention(role.id)} - ${formattedEmoji} - ${channelMention(channel.id)}`);
            container.addTextDisplay(`Choose \`${channel.name}\` to send - Interaction expires <t:${expirationTimestamp}:R>`);
            
            let actionRow = new ActionRowBuilder<ButtonBuilder>();
            actionRow.setComponents([sendButton, button]);
            interaction.editReply({ components: [container.buildContainer(), actionRow], flags: [MessageFlags.IsComponentsV2] })

            let int: ButtonInteraction | null;
            int = await res.resource.message.awaitMessageComponent({componentType: ComponentType.Button, filter: i => i.customId.includes("send"), time: expirationTime}).catch(e => int = null);

            if(!int) {
                interaction.editReply({components: [new TMComponentBuilder().addTextDisplay(`The interaction has expired.`).buildContainer()]})
            } else if(int.customId.includes("send")) {
                let sentContainer = new TMComponentBuilder();
                sentContainer.setAccentColor(config.brand_color);
                sentContainer.addTextDisplay(`## Role Reaction\nClick on the ${formattedEmoji} **${role.name}** button below to toggle the **${role.name}** role!`)
                sentContainer.addSeparator(SeparatorSpacingSize.Large, false)
                sentContainer.addButtonActionRow([button]) 

                channel.send({flags: [MessageFlags.IsComponentsV2], components: [sentContainer.buildContainer()]}).then(() => {
                    int.reply({flags: [MessageFlags.Ephemeral], content: `Sent message to ${channelMention(channel.id)}`})
                }).catch(e => {
                    int.reply({flags: [MessageFlags.Ephemeral], content: `Failed to send message`})
                })
            }
        }

        if (subcommand === "read-config") {
            function stringValue(r: string) {
                return `**${r}** ${config[r]}`
            }

            function listValue(r: string) {
                return `**${r}** ${(config[r] as any[]).join(", ")}`
            }

            let page = 0;
            let expirationTime = 60e3;
            let expirationDate = Date.now() + expirationTime;
            let expirationTimestamp = Math.floor(expirationDate / 1000);

            async function getContainer(): Promise<TMComponentBuilder> {
                let container = new TMComponentBuilder();
                container.setAccentColor(config.brand_color);

                if (page === 0) {
                    container.addTextDisplay(`### Top-Level Values\n- **dev_mode** ${dev_mode}\n- **coduh** ${userMention(config.coduh)}\n- ${stringValue("polls_enabled")}\n- ${stringValue("guild")}\n- ${listValue("valid_guilds")}\n- ${stringValue("brand_color")}\n- ${stringValue("legacy_point_name")}\n- **point_name** ${config.point_name(true, true)} | ${config.point_name(true, false)} | ${config.point_name(false, true)} | ${config.point_name(false, false)}`)
                    container.addSeparator();
                    container.addTextDisplay(`### Channels`)

                    let strs = await Promise.all(Object.entries(config.channels).map(async ([key, value]) => {
                        if (typeof value === "string") {
                            console.log(key, value)
                            return `- **${key}** ${channelMention(value as string)}`;
                        }
                    }))

                    if (strs.length > 0) await container.addTextDisplay(strs.join("\n"))

                    let mediaStr = await Promise.all(config.channels.media_channels.map(async (value) => {
                        let upEmoji = (value?.emojis?.up) ? (Number.isNaN(Number(value.emojis.up)) ? value.emojis.up : formatEmoji(value.emojis.up)) : config.emojis.upvote;
                        let downEmoji = (value?.emojis?.down) ? (Number.isNaN(Number(value.emojis.down)) ? value.emojis.down : formatEmoji(value.emojis.down)) : config.emojis.downvote;

                        return `- ${channelMention(value.id)} ${upEmoji} | ${downEmoji}`;
                    }))

                    container.addSeparator(SeparatorSpacingSize.Small)
                    container.addTextDisplay(`### Media Channels`)
                    if (mediaStr.length > 0) await container.addTextDisplay(mediaStr.join("\n"))
                }

                if (page === 1) {
                    container.addTextDisplay(`### Emojis`)

                    let emojiStrs = await Promise.all(Object.entries(config.emojis).map(async ([key, value]) => {
                        if (typeof value === "string") {
                            let isId = !Number.isNaN(Number(value));

                            return `- **${key}** ${isId ? formatEmoji(value) : value}`;
                        }
                    }))

                    if (emojiStrs.length > 0) container.addTextDisplay(emojiStrs.join("\n"))

                    container.addSeparator();
                    container.addTextDisplay(`### Roles`)

                    let roleStrs = await Promise.all(Object.entries(config.roles).map(async ([key, value]) => {
                        if (typeof value === "string") {
                            return `- **${key}** ${roleMention(value)}`;
                        } else if (key === "levels") {
                            let r = await Promise.all(Object.entries(value as Object).map(async ([key, value]) => {
                                return `- **Level ${key}** ${roleMention(value)}`
                            }));

                            return r.join("\n")
                        }
                    }))

                    if (roleStrs.length > 0) container.addTextDisplay(roleStrs.join("\n"))
                }

                if (page === 2) {
                    container.addTextDisplay(`### Level Perks`)

                    let perkStrs = await Promise.all(Object.entries(config.level_perks).map(async ([key, value]) => {
                        if (typeof value === "string") {
                            return `- **Level ${key}** ${value}`;
                        } else if (value !== null) {
                            return `- **Level ${key}** choice: ${value.join(", ")}`
                        }
                    }))

                    if (perkStrs.length > 0) container.addTextDisplay(perkStrs.join("\n"))

                    container.addSeparator();
                    container.addTextDisplay(`### XP Multiplier Settings\n- **base** ${config.xp_multipliers.base}\n- **sub** ${config.xp_multipliers.sub}`)
                }

                container.addSeparator();
                container.addTextDisplay(`-# Page ${page + 1}/3`)
                container.addButtonActionRow([
                    TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "⬅️", null, null, { action: "down", interactionId: interaction.id }).setDisabled(page === 0),
                    TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "➡️", null, null, { action: "up", interactionId: interaction.id }).setDisabled(page === 2),
                ])
                container.addTextDisplay(`-# This interaction expires <t:${expirationTimestamp}:R>`);

                return container;
            }

            await interaction.editReply({ components: [(await getContainer()).buildContainer()], flags: [MessageFlags.IsComponentsV2] })

            let buttonCollector = res.resource.message.createMessageComponentCollector({ componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, time: expirationTime, })

            buttonCollector.on("collect", async button => {
                await button.deferUpdate();
                if (button.customId.includes("down")) {
                    if (page !== 0) page -= 1;
                    await interaction.editReply({ components: [(await getContainer()).buildContainer()], flags: [MessageFlags.IsComponentsV2] })
                }

                if (button.customId.includes("up")) {
                    console.log("UP", page, " -> ", page + 1)
                    if (page !== 2) page += 1;
                    await interaction.editReply({ components: [(await getContainer()).buildContainer()], flags: [MessageFlags.IsComponentsV2] })
                }
            })

            buttonCollector.on('end', c => {
                interaction.editReply({ components: [new TMComponentBuilder().addTextDisplay("This interaction has expired").buildContainer()] })
            })
        }


    }
}

export default DevCommand;