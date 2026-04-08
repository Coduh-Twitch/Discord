import { ApplicationCommandOptionType, ChatInputCommandInteraction, Colors, ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { Command } from "../classes/Command";
import config from "../config";
import axios from "axios";
import { userModel } from "../models/user";
import { TMComponentBuilder } from "../classes/ComponentBuilder";

interface MEE6LeaderboardPlayer {
    avatar: string;
    discriminator: string;
    guild_id: string;
    id: string;
    message_count: number;
    monetize_xp_boost: number;
    username: string;
    xp: number;
    is_monetize_subscriber: boolean;
    detailed_xp: number[];
    level: number;
}

async function getMee6Leaderboard(guildId: string | null = null): Promise<MEE6LeaderboardPlayer[]> {
    try {

        if (!guildId) guildId = config.guild;
        let url = `https://mee6.xyz/api/plugins/levels/leaderboard/${guildId}`;
        let response = await axios.get(url);
        if (!response || !response.data || !response.data?.players) return [];
        let players = response.data.players as MEE6LeaderboardPlayer[];

        return players || [];
    } catch (e) {
        return [];
    }
}

const SyncXpCommand: Command = {
    enabled: true,
    name: 'syncxp',
    description: "Sync all users' XP with the MEE6 API",
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    options: [
        {
            name: "only_lower",
            description: "Only sync the XP of users who have LESS XP than their MEE6 profile",
            type: ApplicationCommandOptionType.Boolean,
            required: false
        }
    ],
    run: async (interaction: ChatInputCommandInteraction) => {
        let only_lower = interaction.options.getBoolean("only_lower", false) || false;

        let players = await getMee6Leaderboard(config.guild);
        if (players.length === 0) return interaction.reply({ flags: [MessageFlags.Ephemeral], content: `Could not find XP data for the specified server ID.` })

        if (only_lower) {
            players.forEach(async player => {
                let dbPlayer = await userModel.findOne({ id: player.id });
                if (dbPlayer && dbPlayer.xp > player.xp) players = players.filter(p => p.id !== player.id);
            })
        }

        let guildMembers = await interaction.guild.members.fetch();
        let reviewContainer = new TMComponentBuilder();
        reviewContainer.setAccentColor(config.brand_color)
        reviewContainer.addTextDisplay(`## XP Sync Preview`)

        let failed = 0;
        let arr = guildMembers.toJSON();
        await players.forEach(async (p, i) => {
            try {
                let m = await interaction.guild.members.fetch(p.id);
                let dbPlayer = await userModel.findOne({ id: m.id });
                let lbPlayer = players.find(p => p.id === m.id)
                if ((players.some(p => p.id === m.id) || !dbPlayer) && lbPlayer) {
                    let curXp = dbPlayer && dbPlayer.xp ? dbPlayer.xp : 0;
                    let lbXp = lbPlayer.xp;
                    let str = (curXp === lbXp) ? " [No Change]" : (curXp > lbXp) ? ` [-${curXp - lbXp}]` : (curXp < lbXp) ? ` [+${lbXp - curXp}]` : ``
                    reviewContainer.addTextDisplay(`${i + 1}. **${m.user.username}**: ~~${curXp.toLocaleString()}~~ -> **${lbXp.toLocaleString()}**${str}`)
                }
            } catch (e) {
                failed += 1;
            }
        })

        let confirmationTimeout = 10e3;
        let expiryTimestamp = Date.now() + confirmationTimeout;

        function floorDiv(n: number): number {
            return Math.floor(n / 1000);
        }

        if (failed > 0) {
            reviewContainer.addSeparator();
            reviewContainer.addTextDisplay(`-# Failed to fetch ${failed} user${failed === 1 ? "" : "s"}`)
        }

        reviewContainer.addSeparator()
        reviewContainer.addTextDisplay(`-# This interaction expire${floorDiv(Date.now()) > floorDiv(expiryTimestamp) ? "d" : "s"} <t:${floorDiv(expiryTimestamp)}:R>`)

        let timeoutContainer = new TMComponentBuilder();
        timeoutContainer.setAccentColor(Colors.Red)
        timeoutContainer.addTextDisplay(`-# This interaction expired <t:${floorDiv(expiryTimestamp)}:R>`)

        console.log(players);
        let reply = await interaction.reply({ flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2], components: [reviewContainer.buildContainer()], withResponse: true });

        reply.resource.message.awaitMessageComponent({ componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, time: confirmationTimeout }).then(async r => {

        }, async (e) => {
            if (interaction.replied) await interaction.editReply({ components: [timeoutContainer.buildContainer()] })

        }).catch(async e => {
            if (interaction.replied) await interaction.editReply({ components: [timeoutContainer.buildContainer()] })
        });
    }
}

export default SyncXpCommand;