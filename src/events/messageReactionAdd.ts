import { AttachmentBuilder, flatten, formatEmoji, MessageFlags, MessageReaction, MessageReactionEventDetails, ReactionType, User } from "discord.js";
import config from "../config";
import { TMComponentBuilder } from "../classes/ComponentBuilder";

export default {
    enabled: true,
    run: async (reaction: MessageReaction, user: User, details: MessageReactionEventDetails) => {
        console.log(reaction)
        if(user.bot) return;
        let emoji = reaction.emoji.id || reaction.emoji.name;

        if(config.channels.media_channels.some(c => c.id === reaction.message.channelId)) {
            let channelData = config.channels.media_channels.find(c => c.id === reaction.message.channelId);
            let upReact = channelData?.emojis ? channelData.emojis.up : config.emojis.upvote;
            let downReact = channelData?.emojis ? channelData.emojis.down : config.emojis.downvote;

            await reaction.message.fetch(true);

            let upReactors = (reaction.message.reactions.cache.get(upReact));
            let downReactors = reaction.message.reactions.cache.get(downReact);

            if(emoji === downReact) {
                upReactors.users.remove(user.id)
            }

            if(emoji === upReact) {
                downReactors.users.remove(user.id)
                
            }

            let maxFileSize = 9524608;

            if(upReactors.count === 2) {
                let container = new TMComponentBuilder();
                container.setAccentColor(config.brand_color);

                let attachments = reaction.message.attachments.filter(a => (a.contentType.includes("image") || a.contentType.includes("video")) && a.size <= maxFileSize);
                let file = reaction.message.attachments.first();
                let files = attachments.size > 0 ? attachments.toJSON() : file ? [file.url] : [null];


                container.addTextDisplay(`### ${!Number.isNaN(Number(upReact)) ? formatEmoji(upReact) : `${upReact}`} ${reaction.message.author.username}'s post reached 10 upvotes!`);
                
                if(attachments.size <= 0) {
                    if(file && file.size <= maxFileSize) {
                        container.addSeparator();
                        container.addFile(file);
                    }
                } else {
                    container.addSeparator();
                    container.addMediaGallery(attachments.map(attachment => ({media: {url: attachment.url}})));
                }


                reaction.message.reply({flags: [MessageFlags.IsComponentsV2], components: [container.buildContainer()], files: [...files.filter(f => f !== null)], allowedMentions: {repliedUser: false}})
            }

        }
        
        // reaction.message.channel.isSendable() ? reaction.message.channel.send(`${emoji}`) : {};
    }
}