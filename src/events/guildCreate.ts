import { Colors, Guild, MessageFlags } from "discord.js";
import config from "../config";
import { TMComponentBuilder } from "../classes/ComponentBuilder";

export default {
    enabled: true,
    run: async (guild: Guild) => {
        if(!config.valid_guilds.includes(guild.id)) {
            try {
                let guildOwner = await guild.fetchOwner();
                const goodbye = new TMComponentBuilder();
                goodbye.setAccentColor(Colors.Red);
                goodbye.addTextDisplay(`## Incompatible Server\n${guild.client.user.username} has left your server: **${guild.name}**, because it is not compatible.\n\nIf this is a mistake, please reach out via the contact on my [GitHub page](https://github.com/Coduh-Twitch)`)

                guildOwner.send({flags: [MessageFlags.IsComponentsV2], components: [goodbye.buildContainer()]});
            } catch(e) {
                console.log(`Left guild & Failed to DM owner ${guild.name} (${guild.id})`)
            }

            await guild.leave();
        }
    }
}