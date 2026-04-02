import { AttachmentBuilder, GuildMember, MessageFlags, TextChannel } from "discord.js";
import config from "../config";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { avg } from "..";
import { userModel } from "../models/user";



export default {
    enabled: true,
    run: async (member: GuildMember) => {
        const dbUser = await userModel.findOne({id: member.id})
        if(!dbUser) {
            const newUser = new userModel({
                id: member.id,
                lastMessageTimestamp: null,
                level: 0,
                xp: 0,
                shownWelcomeMessage: false,
                deletion_flag: null
            })

            try {
                newUser.save();
            } catch(e) {
                console.log(`Failed to create new user doc for ${member.id}`, e)
            }

            return;
        } else {
            if(dbUser.deletion_flag > 0) {
                await userModel.findOneAndUpdate({id: dbUser.id}, {deletion_flag: null})
            }
        }
        
    }
}