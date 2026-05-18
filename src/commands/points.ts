import { ApplicationCommandOptionType, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Component, ComponentType, ContextMenuCommandInteraction, Events, MessageFlags, PermissionFlagsBits, SeparatorSpacingSize, userMention } from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { version } from "../../package.json";
import { avg, dev_mode, reply, toHHMMSS } from "..";
import config from "../config";
import { hostname } from "os";
import { DBUser, userModel } from "../models/user";
import { calculateRequiredXP } from "../utils/xpUtils";
import { appEmoji } from "../utils/emojiUtils";

const PointsCommand: Command = {
    enabled: true,
    category: CommandCategory.ECONOMY,
    name: `${config.point_name(true, false)}s`,
    description: `${config.point_name()}s Information`,
    options: [
        {
            name: "view",
            description: `See how many ${config.point_name(true)}s you or another user has`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: `The user who's ${config.point_name(true)}s you want to see, leave blank for yourself`,
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        },
        {
            name: "pay",
            description: `Pay ${config.point_name(true)}s to another user from your own balance`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: `The user you intend to pay`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "amount",
                    description: `The amount of ${config.point_name(true)}s you intend to pay`,
                    type: ApplicationCommandOptionType.Integer,
                    min_value: 1,
                    max_value: 999999999,
                    required: true
                }
            ]
        },
        {
            name: "leaderboard",
            description: `View the ${config.point_name(true)} leaderboard`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "allow-any-interaction",
                    description: "Allow anyone to interact with your leaderboard?",
                    type: ApplicationCommandOptionType.Boolean,
                    required: false
                }
            ]
        }
    ],
    defaultMemberPermissions: [PermissionFlagsBits.ViewChannel],
    run: async (interaction: ChatInputCommandInteraction) => {
        const subCommand = interaction.options.getSubcommand(true);
        if (!interaction.guild) return;
        switch (subCommand) {
            case "pay": {
                await interaction.deferReply();

                let target = interaction.options.getUser("user", true);
                let targetMember = interaction.guild.members.cache.get(target.id);
                let amount = Math.floor(interaction.options.getInteger("amount", true));

                let dbUser = await userModel.findOne({ id: interaction.user.id });
                let dbTarget = await userModel.findOne({ id: target.id });

                if (!dbUser || (dbUser && dbUser.points < amount)) return interaction.editReply({ content: `${await appEmoji(interaction.client, "nono")} You don't have enough ${config.point_name(true)}s (you have ${dbUser?.points || 0})` });
                if (amount <= 0) return interaction.editReply({ content: `${await appEmoji(interaction.client, "nono")} You must pay at least 1 ${config.point_name(true)}` });

                let updatedTarget: DBUser;

                try {
                    if (!dbTarget) {
                        let newDbUser = new userModel({
                            id: target.id,
                            points: amount,
                            xp: 0,
                            level: 0
                        })

                        updatedTarget = await newDbUser.save();
                    } else {
                        dbTarget.set("points", dbTarget.points + amount);
                        updatedTarget = await dbTarget.save();
                    }

                    let paidContainer = new TMComponentBuilder();
                    paidContainer.setAccentColor(config.brand_color);
                    paidContainer.addTextDisplay(`### ${userMention(interaction.user.id)} paid ${amount.toLocaleString()} ${config.point_name(true)}${amount === 1 ? "" : "s"} to **${amount > 100 ? userMention(target.id) : targetMember.displayName || targetMember.user.username}**!`)
                    paidContainer.addSeparator(SeparatorSpacingSize.Small);
                    paidContainer.addTextDisplay(`-# <t:${Math.floor(Date.now() / 1000)}:R>`)

                    interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [paidContainer.buildContainer()]})


                } catch (e) {
                    interaction.editReply({content: `Something went wrong while paying **${target.username}** ${await appEmoji(interaction.client, "noooo")}`})
                }



                break;
            }
            case "view": {
                let user = interaction.options.getUser("user", false);
                if (!user) user = interaction.user;

                let member = interaction.guild.members.cache.get(user.id);
                if (!member) {
                    interaction.reply({ flags: [MessageFlags.Ephemeral], content: `A member with ID ${user.id} does not exist.` })
                    return;
                }


                let dbUser = await userModel.findOne({ id: user.id });
                if (!dbUser) {
                    const newUser = new userModel({
                        id: user.id,
                        lastMessageTimestamp: null,
                        level: 0,
                        xp: 0,
                        points: 0,
                        shownWelcomeMessage: false,
                        favorite_movies: []
                    })

                    try {
                        dbUser = await newUser.save();


                    } catch (e) {
                        console.log(`Failed to create new user doc for ${user.id}`, e)
                        interaction.reply({ flags: [MessageFlags.Ephemeral], content: `A member with ID ${user.id} could not be found.` })
                        return
                    }
                }

                const con = new TMComponentBuilder().setAccentColor(await avg(member.displayAvatarURL()) ? await avg(member.displayAvatarURL()) as number : config.brand_color);
                con.addTextDisplay(`**@${member.user.username}** currently has ${config.emojis.points} **${dbUser.points.toLocaleString()}** ${config.point_name()}${dbUser.points === 1 ? "" : "s"}!`);

                interaction.reply({ flags: [MessageFlags.IsComponentsV2], components: [con.buildContainer()], allowedMentions: { users: [], repliedUser: false } })

                break;
            }
            case "leaderboard": {
                let allowAnyone = interaction.options.getBoolean("allow-any-interaction", false) || false;
                let users: DBUser[] = (await userModel.find({ points: { $ne: null } })).sort((a, b) => b.points - a.points);
                let allUsers: DBUser[] = users.map(u => u);
                let ENTRIES_PER_PAGE = 10;
                let pages: (DBUser[])[] = [];
                let index = 0;
                let pg = 0;

                users.forEach(user => {
                    if (!pages[index] || (pages[index] && pages[index]?.length < ENTRIES_PER_PAGE)) {
                        if (!pages[index]) { pages[index] = [user]; } else {
                            pages[index] = [...pages[index], user]
                        }
                    } else {
                        index += 1;
                        if (!pages[index]) { pages[index] = [user]; } else pages[index] = [...pages[index], user];
                    }
                })

                console.log(pages);

                async function buildLeaderboard(page: number, expired: boolean = false): Promise<TMComponentBuilder> {

                    let userStr = await Promise.all(pages[page].map(async (u, i) => {

                        let member = interaction.guild.members.cache.get(u.id)
                        if (member && !member?.user?.bot) {
                            return (`${allUsers.indexOf(u) + 1 <= 3 ? `${"#".repeat(allUsers.indexOf(u) + 1)} ` : ""}${await appEmoji(interaction.client, `${allUsers.indexOf(u) + 1 === 1 ? `crown` : allUsers.indexOf(u) + 1}${(allUsers.indexOf(u) + 1 === 10 || allUsers.indexOf(u) + 1 === 1) ? "" : "_"}`) || `${allUsers.indexOf(u) + 1}.`} **${member.displayName}** [${u.points.toLocaleString()}]`)
                        }
                    }));

                    let container = new TMComponentBuilder();
                    container.addTextDisplay(`## ${config.point_name()}s Leaderboard`)
                    container.addSeparator(SeparatorSpacingSize.Small, false);
                    container.addThumbnailAccessorySection(`${userStr.join("\n")}`, interaction.guild.iconURL())
                    container.setAccentColor(config.brand_color);
                    container.addSeparator();
                    if (!expired) container.addButtonActionRow([
                        pages.length > 1 ? TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "\t", null, { name: "⬅️" }, { action: "down", interactionId: interaction.id }).setDisabled(page === 0) : null,
                        TMComponentBuilder.accessoryButton(ButtonStyle.Secondary, `${page + 1}/${pages.length}`, null, null, { action: "none", interactionId: interaction.id }).setDisabled(true),
                        pages.length > 1 ? TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "\t", null, { name: "➡️" }, { action: "up", interactionId: interaction.id }).setDisabled(page === (pages.length - 1)) : null,
                    ])
                    if (expired) container.addTextDisplay(`-# Interaction Expired`)
                    container.addSeparator(SeparatorSpacingSize.Small, false);
                    container.addTextDisplay(`-# **Page ${page + 1} of ${pages.length}** ∙ **Requested by ${userMention(interaction.user.id)}**`)

                    return container;
                }

                let res = await interaction.reply({ flags: [MessageFlags.IsComponentsV2], components: [(await buildLeaderboard(pg)).buildContainer()], withResponse: true });

                let buttonCol = res.resource.message.createMessageComponentCollector({ componentType: ComponentType.Button, filter: !allowAnyone ? (i => (i.user.id === interaction.user.id)) : (i => i.user !== null) })

                buttonCol.on("collect", async button => {
                    button.deferUpdate();
                    if (button.customId.includes("up")) {
                        if (pg !== pages.length - 1) {
                            pg += 1;
                            interaction.editReply({ components: [(await buildLeaderboard(pg)).buildContainer()] })
                        }
                    }

                    if (button.customId.includes("down")) {
                        if (pg !== 0) {
                            pg -= 1;
                            interaction.editReply({ components: [(await buildLeaderboard(pg)).buildContainer()] })
                        }
                    }
                })

                break;
            }
        }
    },
}

export default PointsCommand;