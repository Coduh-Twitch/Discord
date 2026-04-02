import { Events, GuildMember } from "discord.js";
import { userModel } from "../models/user";
import { logEvent } from "..";

export default {
    enabled: true,
    run: async (member: GuildMember) => {
        const dbUser = await userModel.findOne({id: member.id});
        if(!dbUser) {
            console.log(`Departing user ${member.id} has no DB entry. Skipping.`)
            logEvent(Events.GuildMemberRemove, {member})
            return;
        } else {
            let thresholdMs = (86400e3 * 30);
            try {

                await userModel.findOneAndUpdate({id: dbUser.id}, {deletion_flag: new Date(Date.now() + thresholdMs).getTime()})
                logEvent(Events.GuildMemberRemove, {member, flag: new Date(Date.now() + thresholdMs).getTime()})
            } catch(e) {
                logEvent(Events.GuildMemberRemove, {member})
            }
        }
    }
}