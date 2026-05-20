import { blockQuote, channelMention, GuildMember, MessageFlags, SeparatorSpacingSize, TextChannel, userMention } from "discord.js";
import config from "../config";
import { avg } from "..";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { userModel } from "../models/user";
import { memberWelcomeImage } from "../utils/canvasUtils";
import { appEmoji } from "../utils/emojiUtils";
import { post } from "axios";


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
                shownWelcomeMessage: true,
                favorite_movies: []
            })

            try {
                const doc = await newUser.save();
                dbUser = doc;
            } catch(e) {
                console.log(`Failed to create new user doc for ${member.id}`, e)
            }
            }
            if(dbUser && dbUser.shownWelcomeMessage) return; 

        const introChannel: TextChannel = member.guild.channels.cache.get(config.channels.joins) as TextChannel;
        const hangoutChannel: TextChannel = member.guild.channels.cache.get(config.channels.hangout) as TextChannel;
        const con = new TMComponentBuilder().setAccentColor(await avg(member.displayAvatarURL()) as number);
        let image = await memberWelcomeImage(new_member);

        let emojis = ["coduhlove", "coduhpenguin", "jiggy", "glorp", "owoj", "rizz", "spike", "sniffa", "yay"]
        let random = Math.floor(Math.random() * emojis.length);

        function channelDescription(channelId: string, description: string): string {
            return `- ${channelMention(channelId)} - *${description}*`
        }

        con.addThumbnailAccessorySection(`## ${await appEmoji(new_member.client, emojis?.[random] || emojis[0])} Welcome to coduh's crib, ${userMention(new_member.id)}!\n-# Joined <t:${Math.floor(member.joinedTimestamp / 1000)}:R> ∙ Account Created <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n\n**Check out the most common channels for new members!**`, member.displayAvatarURL())
        con.addTextDisplay(`${blockQuote(`${channelDescription(config.channels.streams, "Get a notification when Coduh goes live on [Twitch](https://twitch.tv/coduh)!")}\n${channelDescription(config.channels.jackbox, "Codes are posted here during Jackbox streams")}\n${channelDescription(config.channels.wordle, "Compete in the daily Wordle with the community!")}\n${channelDescription(config.channels.movie_suggestions, "Suggest your favorite movies for our monthly movie nights!")}\n${channelDescription(config.channels.movie_polls, "Vote for the final choice in our monthly movie pick")}`)}`)

        // con.addSeparator(SeparatorSpacingSize.Small, false)

        // let profileCommandId = member.client.application.commands.cache.find(c => c.name === "profile").id

        // con.addTextDisplay(`**Your Profile**\n\nUse </profile view:${profileCommandId}> to view your profile, including your **top 5 favorite movies**!\n\nAdd your first favorite movie with </profile movies add:${profileCommandId}>, and fine-tune your list with </profile movies reorder:${profileCommandId}>!`);
        // if(image) con.addMediaGallery([{media: {url: image.url}}]);
    
        hangoutChannel.send({flags: [MessageFlags.IsComponentsV2], components: [con.buildContainer()]})
        if(image) introChannel.send({files: [image.attachment]})
        dbUser.set("shownWelcomeMessage", true)
        dbUser.set("lastMessageTimestamp", Date.now())
        try {
            dbUser.save()
        } catch(e) {
            console.log(`Failed to save user doc for id ${dbUser.id}`)
        }

        try {
            await post(`${process.env.CHATBOT_BASE_URL}/api/discord/new-member`, {username: new_member.user.username, memberCount: new_member.guild.memberCount});
        } catch(e) {
            console.log(`Failed to notify Twitch app of new member`)
        }
        }
    }
}