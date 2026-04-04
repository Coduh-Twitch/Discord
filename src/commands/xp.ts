import { ApplicationCommandOptionType, ChatInputCommandInteraction, Events, MessageFlags, PermissionFlagsBits } from "discord.js";
import { Command } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { version } from "../../package.json";
import { avg, dev_mode, reply, toHHMMSS } from "..";
import config from "../config";
import { hostname } from "os";
import { userModel } from "../models/user";
import { calculateRequiredXP } from "../utils/xpUtils";

const XPCommand: Command = {
    enabled: true,
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
        }
    ],
    defaultMemberPermissions: [PermissionFlagsBits.ViewChannel],
    run: async (interaction: ChatInputCommandInteraction) => {
        const subCommand = interaction.options.getSubcommand(true);
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
                        shownWelcomeMessage: false
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
        }
    },
}

export default XPCommand;