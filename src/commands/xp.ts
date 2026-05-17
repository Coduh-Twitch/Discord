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

const XPCommand: Command = {
    enabled: true,
    category: CommandCategory.LEVELING,
    name: "xp",
    description: "XP Information",
    options: [
        {
            name: "profile",
            description: "Get your or another user's XP profile!",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "The user who's XP profile you want to see!",
                    type: ApplicationCommandOptionType.User,
                    required: false
                }
            ]
        },
        {
            name: "leaderboard",
            description: "View the XP leaderboard",
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
        if(!interaction.guild) return;
        switch (subCommand) {
            case "profile": {
                let user = interaction.options.getUser("user", false);
                if (!user) user = interaction.user;

                let member = interaction.guild.members.cache.get(user.id);
                if (!member) {
                    interaction.reply({ flags: [MessageFlags.Ephemeral], content: `A member with ID ${user.id} does not exist.` })
                    return;
                }

                let xpProfile: { xp: number; level: number; } = { xp: 0, level: 0 };

                const dbUser = await userModel.findOne({ id: user.id });
                if (!dbUser) {
                    const newUser = new userModel({
                        id: user.id,
                        lastMessageTimestamp: null,
                        level: 0,
                        xp: 0,
                        shownWelcomeMessage: false,
                        favorite_movies: []
                    })

                    try {
                        newUser.save();


                    } catch (e) {
                        console.log(`Failed to create new user doc for ${user.id}`, e)
                        interaction.reply({ flags: [MessageFlags.Ephemeral], content: `A member with ID ${user.id} could not be found.` })
                        return
                    }
                } else {
                    xpProfile.level = dbUser.level;
                    xpProfile.xp = dbUser.xp;
                }

                const con = new TMComponentBuilder().setAccentColor(await avg(member.displayAvatarURL()) ? await avg(member.displayAvatarURL()) as number : config.brand_color);
                con.addThumbnailAccessorySection(`# ${member.user.username} | XP\n**Level** | \`${xpProfile.level}${xpProfile.level === 10 ? " (MAX)" : ""}\` (${interaction.guild.roles.cache.get(config.roles.levels[xpProfile.level.toString()]) ? interaction.guild.roles.cache.get(config.roles.levels[xpProfile.level.toString()]).name : "No Role"})\n**XP Total** | \`${xpProfile.xp}\`${xpProfile.level !== 10 ? ` (${(calculateRequiredXP(xpProfile.level+1) - xpProfile.xp).toLocaleString()} XP to level ${xpProfile.level+1})` : ""}`, member.displayAvatarURL());

                interaction.reply({flags: [MessageFlags.IsComponentsV2], components: [con.buildContainer()]})

                break;
            }
            case "leaderboard": {
                let allowAnyone = interaction.options.getBoolean("allow-any-interaction", false) || false;
                let users: DBUser[] = (await userModel.find({xp: {$ne: null}})).sort((a, b) => b.xp - a.xp);
                let allUsers: DBUser[] = users.map(u => u);
                let ENTRIES_PER_PAGE = 10;
                let pages: (DBUser[])[] = [];
                let index = 0;
                let pg = 0;

                users.forEach(user => {
                    if(!pages[index] || (pages[index] && pages[index]?.length < ENTRIES_PER_PAGE)) {
                        if(!pages[index]) {pages[index] = [user];} else {
                            pages[index] = [...pages[index], user]
                        }
                    } else {
                        index+=1;
                        if(!pages[index]) {pages[index] = [user];} else pages[index] = [...pages[index], user];
                    }
                })

                console.log(pages);

                async function buildLeaderboard(page: number, expired: boolean = false): Promise<TMComponentBuilder> {
                    
                    let userStr = await Promise.all(pages[page].map(async (u, i) => {
                        
                        let member = interaction.guild.members.cache.get(u.id)
                        if(member && !member?.user?.bot) {
                            return (`${allUsers.indexOf(u) + 1 <= 3 ? `${"#".repeat(allUsers.indexOf(u) + 1)} ` : ""}${await appEmoji(interaction.client, `${allUsers.indexOf(u) + 1 === 1 ? `crown` : allUsers.indexOf(u) + 1}${(allUsers.indexOf(u) + 1 === 10 || allUsers.indexOf(u) + 1 === 1) ? "" : "_"}`) || `${allUsers.indexOf(u) + 1}.`} **${member.displayName}** [${u.xp.toLocaleString()} XP]`)
                        }
                    }));
                    
                    let container = new TMComponentBuilder();
                    container.addTextDisplay(`## XP Leaderboard`)
                    container.addSeparator(SeparatorSpacingSize.Small, false);
                    container.addThumbnailAccessorySection(`${userStr.join("\n")}`, interaction.guild.iconURL())
                    container.setAccentColor(config.brand_color);
                    container.addSeparator();
                    if(!expired) container.addButtonActionRow([
                        pages.length > 1 ? TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "\t", null, {name: "⬅️"}, {action: "down", interactionId: interaction.id}).setDisabled(page === 0) : null,
                        TMComponentBuilder.accessoryButton(ButtonStyle.Secondary, `${page + 1}/${pages.length}`, null, null, {action: "none", interactionId: interaction.id}).setDisabled(true),
                        pages.length > 1 ? TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "\t", null, {name: "➡️"}, {action: "up", interactionId: interaction.id}).setDisabled(page === (pages.length - 1)) : null,
                    ])
                    if(expired) container.addTextDisplay(`-# Interaction Expired`)
                    container.addSeparator(SeparatorSpacingSize.Small, false);
                    container.addTextDisplay(`-# **Page ${page + 1} of ${pages.length}** ∙ **Requested by ${userMention(interaction.user.id)}**`)

                    return container;
                }

                let res = await interaction.reply({flags: [MessageFlags.IsComponentsV2], components: [(await buildLeaderboard(pg)).buildContainer()], withResponse: true});

                let buttonCol = res.resource.message.createMessageComponentCollector({componentType: ComponentType.Button, filter: !allowAnyone ? (i => (i.user.id === interaction.user.id)) : (i => i.user !== null) })
                
                buttonCol.on("collect", async button => {
                    button.deferUpdate();
                    if(button.customId.includes("up")) {
                        if(pg !== pages.length - 1) {
                            pg+=1;
                            interaction.editReply({components: [(await buildLeaderboard(pg)).buildContainer()]})
                        }
                    }

                    if(button.customId.includes("down")) {
                        if(pg !== 0) {
                            pg-=1;
                            interaction.editReply({components: [(await buildLeaderboard(pg)).buildContainer()]})
                        }
                    }
                })

                break;
            }
        }
    },
}

export default XPCommand;