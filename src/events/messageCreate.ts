import { Message } from "discord.js";
import { addXP, calculateGivenXP } from "../utils/xpUtils";
import { dev_mode } from "..";
import { userModel } from "../models/user";

export default {
    enabled: true,
    run: async (message: Message) => {
        if(message.author.bot) return;
        if(!dev_mode && (message.content.length < 5)) return;

        await addXP(message.member, message.content);
        await userModel.findOneAndUpdate({id: message.author.id}, {lastMessageTimestamp: Date.now()})
    }
}