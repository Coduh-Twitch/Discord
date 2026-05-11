import { ApplicationCommandOptionType, ButtonStyle, ChatInputCommandInteraction, Colors, MessageFlags, resolveColor, SeparatorSpacingSize } from "discord.js";
import { Command } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { getAverageColor } from "fast-average-color-node";
import { userModel } from "../models/user";

const ProfileCommand: Command = {
    enabled: true,
    name: "profile",
    description: "See a user's profile",
    options: [
        {
            name: "user",
            description: "The user who's profile you'd like to see",
            type: ApplicationCommandOptionType.User,
            required: false
        }
    ],
    run: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply();

        let user = interaction.options.getUser("user", false) || interaction.user;

        let avatar = user.displayAvatarURL({size: 512});
        let avc = (await getAverageColor(avatar)).hex.replace("#", "");

        let container = new TMComponentBuilder();
        container.setAccentColor(Number(`0x${avc}`))

        let dbUser = await userModel.findOne({id: user.id});

        let member = interaction.guild?.members.cache.get(user.id);

        container.addThumbnailAccessorySection(`## @${user.displayName}\n-# ${user.username} ∙ ${user.id}\n\n${dbUser ? `📊 Level ${dbUser.level} - ✨ **${dbUser.xp.toLocaleString()}** XP` : ""}`, avatar)

        container.addSeparator(SeparatorSpacingSize.Small, false);
        if(member?.joinedTimestamp) container.addTextDisplay(`-# Joined Server <t:${Math.floor(member.joinedTimestamp  / 1000)}:R> ∙ Account Created <t:${Math.floor(user.createdTimestamp / 1000)}:R>`);

        let highestRoleName = member?.roles.highest.name;
        if(highestRoleName) {
            container.addSeparator()
            container.addButtonAccessorySection(`### Highest Role`, ButtonStyle.Secondary, highestRoleName, {action: "beauty", interactionId: interaction.id})
        }
        

        interaction.editReply({components: [container.buildContainer()], flags: [MessageFlags.IsComponentsV2]})
    }
}

export default ProfileCommand;