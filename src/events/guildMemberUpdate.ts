import { GuildMember, MessageFlags, TextChannel, userMention } from "discord.js";
import config from "../config";
import { avg } from "..";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { userModel } from "../models/user";
import { memberWelcomeImage } from "../utils/canvasUtils";


export default {
    enabled: true,
    run: async (old_member: GuildMember, new_member: GuildMember) => {
        if(!old_member.roles.cache.has(config.roles.members) && new_member.roles.cache.has(config.roles.members)) {
            console.log(`${new_member.user.username} now has member role`)
            let member = new_member;

            let dbUser = await userModel.findOne({id: new_member.id});
            if(!dbUser) {
                const newUser = new userModel({
                id: member.id,
                lastMessageTimestamp: Date.now(),
                level: 0,
                xp: 0,
                shownWelcomeMessage: true
            })

            try {
                const doc = await newUser.save();
                dbUser = doc;
            } catch(e) {
                console.log(`Failed to create new user doc for ${member.id}`, e)
            }
            }
            if(dbUser && dbUser.shownWelcomeMessage) return; 

            const introChannel: TextChannel = member.guild.channels.cache.get(config.channels.hangout) as TextChannel;
        const con = new TMComponentBuilder().setAccentColor(await avg(member.displayAvatarURL()));
        let image = await memberWelcomeImage(new_member);
        con.addTextDisplay(`## Welcome to coduh's crib, ${userMention(new_member.id)}!`)
        if(image) con.addMediaGallery([{media: {url: image.url}}]);
    
        introChannel.send({flags: [MessageFlags.IsComponentsV2], components: [con.buildContainer()], files: [image.attachment]})
        dbUser.set("shownWelcomeMessage", true)
        dbUser.set("lastMessageTimestamp", Date.now())
        try {
            dbUser.save()
        } catch(e) {
            console.log(`Failed to save user doc for id ${dbUser.id}`)
        }
        }
    }
}