import { ChatInputCommandInteraction, Events, MessageFlags, PermissionFlagsBits } from "discord.js";
import { Command } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { version } from "../../package.json";
import { dev_mode, reply, toHHMMSS } from "..";
import config from "../config";
import { hostname } from "os";

const PingCommand: Command = {
    enabled: true,
    name: "ping",
    description: "Pong?",
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    run: async (interaction: ChatInputCommandInteraction) => {
        const i = await interaction.deferReply({
            withResponse: true,
            flags: [MessageFlags.Ephemeral]
        });
        let roundtrip = i.resource.message.createdTimestamp - interaction.createdTimestamp;
        let websocket = interaction.client.ws.ping;

        let con = new TMComponentBuilder().setAccentColor(config.brand_color);
        con.addTextDisplay(`## Service Status (${interaction.client.user.username})\n-# v${version} | ${dev_mode ? "`DEVELOPMENT`" : "`PRODUCTION`"}\n### Hostname | \`${hostname}\`\n### Uptime | \`${toHHMMSS(process.uptime() * 1000)}\`\n### Roundtrip Latency | \`${roundtrip >= 1000 ? "⚠️ " : ""}${roundtrip}ms\`\n### Websocket Latency | \`${websocket >= 1000 ? "⚠️ " : ""}${websocket}ms\``)

        interaction.editReply({components: [con.buildContainer()], flags: [MessageFlags.IsComponentsV2]})
    },
}

export default PingCommand;