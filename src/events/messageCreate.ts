import { EmbedType, Message, MessageFlags, PartialPollAnswer, PollAnswer, TextChannel } from "discord.js";
import { addXP, calculateGivenXP } from "../utils/xpUtils";
import { dev_mode } from "..";
import { userModel } from "../models/user";
import { movieModel } from "../models/movies";
import { buildMovieContainer, getMovieById, sendMoviePoll } from "../commands/movie";

export default {
    enabled: true,
    run: async (message: Message) => {
        if(message.system) {
            console.log("SYSTEM MESSAGE", message)
            // message.channel.isSendable() ? message.channel.send({embeds: [...message.embeds]}) : {};
            let embed = message.embeds[0];
            if(embed && embed.data.type === EmbedType.PollResult) {
                let pollMessageId = message.reference.messageId;
                await message.channel.messages.fetch();
                let pollMessage = message.channel.messages.cache.get(pollMessageId);

                if(pollMessage.poll) {
                    let poll = pollMessage.poll;
                    console.log(poll);
                    let answersSorted = poll.answers.sort((a, b) => b.voteCount - a.voteCount)
                    console.log(answersSorted)
                    let topAnswer: PollAnswer | PartialPollAnswer = answersSorted.at(0);
                    let runnerUp: PollAnswer | PartialPollAnswer = answersSorted.at(1);
                    let tie = runnerUp && (topAnswer?.voteCount === runnerUp?.voteCount);
                    let noContest = topAnswer.voteCount === 0;

                    if(message.channel.isSendable()) {
                        let dbMovies = await movieModel.findOne({guildId: message.guildId});

                        if(noContest) {
                            message.channel.send(`[**No Contest!**](https://tenor.com/view/no-contest-super-smash-brothers-tie-draw-stalemate-gif-26556737)`)
                        }else if(tie) {
                            let winnerMovieId: string | null = dbMovies.get(`movies.${topAnswer.text.replaceAll(".", "-")}`) || null;
                            let runnerUpMovieId: string | null = dbMovies.get(`movies.${runnerUp.text.replaceAll(".", "-")}`) || null;

                            message.channel.send({content: `## We have a tie!\n**${topAnswer.text}** and **${runnerUp.text}** both got ${topAnswer.voteCount} vote${topAnswer.voteCount === 1 ? "" : "s"}!\n\nA new poll will be created shortly to choose a final winner`})

                                setTimeout(async () => {
                                    await sendMoviePoll(null, message.author, message.guildId, message.channel as TextChannel, [winnerMovieId, runnerUpMovieId], false, 8)
                                },10e3)
                        } else {
                            message.channel.send(`**We have a winner!**\n### ${topAnswer.text} (${topAnswer.voteCount})`)
                        }
                    }
                } else return;
            }
        }
        if(message.author.bot) return;
        if(!dev_mode && (message.content.length < 5)) return;

        await addXP(message.member, message.content);
        await userModel.findOneAndUpdate({id: message.author.id}, {lastMessageTimestamp: Date.now()})
    }
}