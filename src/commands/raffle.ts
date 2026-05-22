import { ApplicationCommandOptionType, blockQuote, MessageFlags, PermissionFlagsBits, userMention } from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command";
import config from "../config";
import { raffleModel } from "../models/raffle";
import { appEmoji } from "../utils/emojiUtils";

const RaffleCommand: Command = {
    enabled: true,
    defaultMemberPermissions: [PermissionFlagsBits.ModerateMembers],
    name: "raffle",
    description: `Pick a random winner to get some ${config.point_name(true)}s!`,
    category: CommandCategory.ECONOMY,
    requiredRole: UserLevel.MOD,
    options: [
        {
            name: "start",
            description: "Start a raffle",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.MOD,
            options: [
                {
                    name: "amount",
                    description: `The amount of ${config.point_name(true)}s the winner will get! (Default 1,000)`,
                    type: ApplicationCommandOptionType.Integer,
                    required: false
                }
            ]
        },
        {
            name: "cancel",
            description: "Cancel the current raffle",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.MOD,
        }
    ],
    run: async (interaction) => {
        let subcommand = interaction.options.getSubcommand(true);

        if(subcommand === "start") {
            let amount = interaction.options.getInteger("amount", false) || 1000;
            let raffle = (await raffleModel.find())?.[0] || null;

            if(!raffle) {
                if(amount > 10000) return await interaction.reply({flags: [MessageFlags.Ephemeral], content: `${await appEmoji(interaction.client, "what")} Are you insane? ${amount.toLocaleString()} is way too many ${config.point_name(true)}s (max 10k)`})

                let newRaffle = new raffleModel({
                    channel_id: interaction.channelId,
                    creator_id: interaction.user.id,
                    expires_at: Date.now() + 60e3,
                    participants: [],
                    points: amount,
                })

                raffle = await newRaffle.save();
                if(!raffle) return await interaction.reply({flags: [MessageFlags.Ephemeral], content: `${await appEmoji(interaction.client, "noooo")} Failed to create the raffle :(`})

                await interaction.reply({content: `${userMention(interaction.user.id)} Started a raffle for ${config.emojis.points} **${raffle.points.toLocaleString()} ${config.point_name(false)}${raffle.points === 1 ? "" : "s"}**!\n${blockQuote(`### **Type "pickme" in this chat for a chance to win!**\n-# Raffle Expires <t:${Math.floor(raffle.expires_at / 1000)}:R>`)}`});

            } else return await interaction.reply({flags: [MessageFlags.Ephemeral], content: `${await appEmoji(interaction.client, "nono")} There is already a raffle running!`})
        }

        if(subcommand === "cancel") {
            let raffle = (await raffleModel.find())?.[0] || null;
            if(!raffle) return await interaction.reply({flags: [MessageFlags.Ephemeral], content: `${await appEmoji(interaction.client, "nono")} There is not a raffle running!`})

            
        }
    }
}

export default RaffleCommand