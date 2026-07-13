import {
  blockQuote,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedType,
  Message,
  MessageFlags,
  PartialPollAnswer,
  PermissionFlagsBits,
  PollAnswer,
  TextChannel,
  userMention,
} from "discord.js";
import { addXP, calculateGivenXP } from "../utils/xpUtils";
import { client, dev_mode } from "..";
import { userModel } from "../models/user";
import { movieModel } from "../models/movies";
import {
  buildMovieContainer,
  getMovieById,
  sendMoviePoll,
} from "../commands/movie";
import config from "../config";
import { addPoints } from "../utils/pointUtils";
import { DBRaffleParticipant, raffleModel } from "../models/raffle";
import { appEmoji } from "../utils/emojiUtils";
import { getMee6Leaderboard } from "../commands/syncxp";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import {
  createCustomId,
  generateCustomId,
  parseCustomId,
} from "../utils/customIdUtils";
import { start } from "node:repl";

export default {
  enabled: true,
  run: async (message: Message) => {
    if (message.system) {
      console.log("SYSTEM MESSAGE", message);
      // message.channel.isSendable() ? message.channel.send({embeds: [...message.embeds]}) : {};
      let embed = message.embeds[0];
      if (embed && embed.data.type === EmbedType.PollResult) {
        let pollMessageId = message.reference.messageId;
        await message.channel.messages.fetch();
        let pollMessage = message.channel.messages.cache.get(pollMessageId);

        if (pollMessage.poll) {
          let poll = pollMessage.poll;
          console.log(poll);
          let answersSorted = poll.answers.sort(
            (a, b) => b.voteCount - a.voteCount,
          );
          console.log(answersSorted);
          let topAnswer: PollAnswer | PartialPollAnswer = answersSorted.at(0);
          let runnerUp: PollAnswer | PartialPollAnswer = answersSorted.at(1);
          let tie = runnerUp && topAnswer?.voteCount === runnerUp?.voteCount;
          let noContest = topAnswer.voteCount === 0;

          if (message.channel.isSendable()) {
            let dbMovies = await movieModel.findOne({
              guildId: message.guildId,
            });

            if (noContest) {
              message.channel.send(
                `[**No Contest!**](https://tenor.com/view/no-contest-super-smash-brothers-tie-draw-stalemate-gif-26556737)`,
              );
            } else if (tie) {
              let winnerMovieId: string | null =
                dbMovies.get(`movies.${topAnswer.text.replaceAll(".", "-")}`) ||
                null;
              let runnerUpMovieId: string | null =
                dbMovies.get(`movies.${runnerUp.text.replaceAll(".", "-")}`) ||
                null;

              if (winnerMovieId && runnerUpMovieId)
                message.channel.send({
                  content: `## We have a tie!\n**${topAnswer.text}** and **${runnerUp.text}** both got ${topAnswer.voteCount} vote${topAnswer.voteCount === 1 ? "" : "s"}!\n\nA new poll will be created shortly to choose a final winner`,
                });

              setTimeout(async () => {
                if (winnerMovieId && runnerUpMovieId)
                  await sendMoviePoll(
                    null,
                    message.author,
                    message.guildId,
                    message.channel as TextChannel,
                    [winnerMovieId, runnerUpMovieId],
                    false,
                    4,
                  );
              }, 10e3);
            } else {
              message.channel.send(
                `**We have a winner!**\n### ${topAnswer.text} (${topAnswer.voteCount})`,
              );
            }
          }
        } else return;
      }
    }
    if (message.author.bot) return;
    if (
      !dev_mode &&
      message.content.length < 5 &&
      ![config.channels.honeypot, config.channels.jackbox].includes(
        message.channelId,
      )
    )
      return;

    if (message.channelId === config.channels.jackbox) {
      const code = message.content.trim().toUpperCase();
      if (code.length === 4 && message.author.id === config.coduh) {
        message.react("🎮");
        let container = new TMComponentBuilder().setAccentColor(
          config.brand_color,
        );
        container.addTextDisplay(`## Code Detected\nHiding Channel...`);

        const channel: TextChannel = message.channel as TextChannel;

        message
          .reply({
            flags: [MessageFlags.IsComponentsV2],
            components: [container.buildContainer()],
          })
          .then((m) => {
            channel.permissionOverwrites
              .edit(message.guildId, { ViewChannel: false })
              .then(async () => {
                if (message.deletable) await message.delete();

                const hiddenMs = 30e3;
                const hiddenUntil = Math.floor((Date.now() + hiddenMs) / 1000);

                container = new TMComponentBuilder().setAccentColor(
                  config.brand_color,
                );
                container.addTextDisplay(`-# The code is:\n# ${code}`);
                container.addSeparator();
                container.addTextDisplay(
                  `The lobby is filling up. Enter the code above at https://jackbox.tv to join the game!\n-# The channel is currently priority-only. It wil be public <t:${hiddenUntil}:R>`,
                );

                m.edit({
                  flags: [MessageFlags.IsComponentsV2],
                  components: [container.buildContainer()],
                })
                  .then(async (mm) => {
                    setTimeout(async () => {
                      container = new TMComponentBuilder().setAccentColor(
                        config.brand_color,
                      );
                      container.addTextDisplay(`-# The code is:\n# ${code}`);
                      container.addSeparator();
                      container.addTextDisplay(
                        `The lobby is filling up. Enter the code above at https://jackbox.tv to join the game!`,
                      );
                      await channel.permissionOverwrites.edit(message.guildId, {
                        ViewChannel: true,
                      });
                      container.addSeparator();
                      container.addButtonActionRow([
                        TMComponentBuilder.accessoryButton(
                          ButtonStyle.Secondary,
                          "[Admin] Start Game",
                          null,
                          null,
                          { interactionId: message.id, action: "start-game" },
                        ),
                      ]);

                      const res = await mm.edit({
                        flags: [MessageFlags.IsComponentsV2],
                        components: [container.buildContainer()],
                      });
                      let startInt: ButtonInteraction | null;
                      startInt = await m
                        .awaitMessageComponent({
                          componentType: ComponentType.Button,
                          filter: (i) =>
                            i.guild.members.cache
                              .get(i.user.id)
                              .permissions.has(
                                PermissionFlagsBits.Administrator,
                              ),
                        })
                        .catch(() => (startInt = null));

                      if (
                        startInt &&
                        startInt.customId.includes("start-game")
                      ) {
                        if (mm.deletable) {
                          await mm.delete();
                          startInt.reply({
                            flags: [MessageFlags.Ephemeral],
                            content: `Started Game`,
                          });
                        } else {
                          startInt.reply({
                            flags: [MessageFlags.Ephemeral],
                            content: `Couldn't delete code message. Please delete it yourself. Enjoy the game!`,
                          });
                        }

                        let deleteM = await channel.send({
                          content: `The most recent Jackbox game started <t:${Math.floor(Date.now() / 1000)}:R>\n\nCheck Twitch chat to join the audience!`,
                        });
                        setTimeout(async () => {
                          if (deleteM.deletable) await deleteM.delete();
                        }, 30e3);
                      }
                    }, hiddenMs);
                  })
                  .catch(() => {
                    channel.send({ content: `Code: **${code}**` });
                  });
              })
              .catch(async () => {
                if (m.deletable) await m.delete();
              });
          })
          .catch((e) => {
            //oops
          });
      }
    }

    if (message.channelId === config.channels.honeypot) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers,
          true,
        )
      ) {
        let member = message.member;
        await member.timeout(24 * 60 * 60 * 1000, "🍯 Caught by Honeypot");
        client.emit("honeypotCatch", member, message);
      }
    }

    // Point Freebies
    let dbUser = await userModel.findOne({ id: message.author.id });
    if (!dbUser) {
      let newUser = new userModel({
        xp: 0,
        messages: 1,
        synced: false,
        freebie: true,
        points: 1000,
        level: 0,
      });

      await newUser.save();
      await message.react(config.emojis.points);
    } else if (dbUser && !dbUser.freebie) {
      dbUser.set("freebie", true);
      dbUser.set("points", (dbUser.points || 0) + 1000);

      await dbUser.save();
      await message.react(config.emojis.points);
    }

    if (message.content.toLowerCase().trim().startsWith("pickme")) {
      let raffle = (await raffleModel.find())?.[0] || null;
      if (raffle && raffle.channel_id === message.channelId) {
        let participants = raffle.participants;
        if (!participants.some((p) => p.id === message.author.id)) {
          if (
            participants &&
            participants.length <= 0 &&
            raffle.creator_id === message.author.id
          ) {
            await message.reply({
              content: `${await appEmoji(message.client, "nono")} Someone else has to join the raffle before you can join!`,
            });
          } else {
            raffle.set("participants", [
              ...participants,
              { id: message.author.id, raffle_id: raffle.id },
            ]);
            await raffle.save();
            await message.reply({
              content: `${userMention(message.author.id)} Joined the raffle for ${config.emojis.points} **${raffle.points.toLocaleString()} ${config.point_name(false)}${raffle.points === 1 ? "" : "s"}**!\n${blockQuote(`### **Type "pickme" in this chat for a chance to win!**\n-# Raffle Expires <t:${Math.floor(raffle.expires_at / 1000)}:R>`)}`,
            });
          }
        }
      }
    }

    if (message.attachments.size > 0) {
      if (
        config.channels.media_channels.some((c) => c.id === message.channelId)
      ) {
        let channelData = config.channels.media_channels.find(
          (c) => c.id === message.channelId,
        );
        let upReact = channelData?.emojis
          ? channelData.emojis.up
          : config.emojis.upvote;
        let downReact = channelData?.emojis
          ? channelData.emojis.down
          : config.emojis.downvote;

        message.react(upReact).then((m) => {
          message.react(downReact);
        });
      }
    }

    let channel: TextChannel = message.channel as TextChannel;

    if (
      channel.parent &&
      !config.channels.xp_ignore_categories.includes(channel.id) &&
      !dev_mode
    ) {
      await addXP(message.member, message.content);
      await addPoints(message.member, message.content);
      let dbUser = await userModel.findOne({ id: message.author.id });

      dbUser.set("lastMessageTimestamp", Date.now());
      dbUser.set("messages", dbUser.messages + 1);

      if (!dbUser.synced) {
        let mee6Leaderboard = await getMee6Leaderboard(message.guild.id);
        if (mee6Leaderboard && mee6Leaderboard?.length > 0) {
          let player = mee6Leaderboard.find((p) => p.id === dbUser.id);
          if (player && player?.message_count > 0) {
            dbUser.set("messages", player.message_count);
            dbUser.set("synced", true);
            console.log(
              `Synced message_count for user ${dbUser.id} (${player.message_count.toLocaleString()} message(s))`,
            );
          }
        }
      }

      await dbUser.save();
    }
  },
};
