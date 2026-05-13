import { ApplicationEmoji, Client } from "discord.js";

export const appEmoji = async (client: Client, emojiName: string): Promise<ApplicationEmoji | null> => {
    let ems = await client.application.emojis.fetch()
    let emoji = ems.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
    
    return emoji || null;
}