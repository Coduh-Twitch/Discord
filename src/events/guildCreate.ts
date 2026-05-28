import { ChannelType, Colors, Guild, GuildChannel, Invite, MessageFlags, PermissionFlagsBits, TextChannel } from "discord.js";
import config from "../config"
import { TMComponentBuilder } from "../classes/ComponentBuilder"
import { incompatibleInvites, logContainer } from "..";

export default {
    enabled: true,
    run: async (guild: Guild) => {
        const goodbye = new TMComponentBuilder();
        goodbye.setAccentColor(Colors.Red);
        goodbye.addTextDisplay(`## Incompatible Server\n${guild.client.user.username} has left your server: **${guild.name}**, because it is not compatible.\n\nIf this is a mistake, please reach out via the contact on my [GitHub page](https://github.com/Coduh-Twitch)`)

        if(!config.valid_guilds.includes(guild.id)) {
            try {
                let guildOwner = await guild.fetchOwner();

                let invite: Invite | null = null;
                if(guild.members.cache.get(guild.client.user.id).permissions.has(PermissionFlagsBits.CreateInstantInvite, true)) invite = await guild.invites.create(guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(), {maxAge: 0});

                if(invite) {
                    incompatibleInvites.set(guild.id, invite);
                }

                await guildOwner.send({flags: [MessageFlags.IsComponentsV2], components: [goodbye.buildContainer()]});
            } catch(e) {
                if(guild.members.cache.get(guild.client.user.id).permissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks], true)) {
                    let lastTextChannel = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).last();
                    if(lastTextChannel) {
                        await lastTextChannel.send({flags: [MessageFlags.IsComponentsV2], components: [goodbye.buildContainer()]});
                    } else console.log(`Left guild & Failed to DM owner ${guild.name} (${guild.id})`);
                } else console.log(`Left guild & Failed to DM owner ${guild.name} (${guild.id})`);
            }

            await guild.leave();
        }
    }
}