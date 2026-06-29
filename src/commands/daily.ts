import {
  ApplicationCommandOptionType,
  blockQuote,
  ButtonInteraction,
  ButtonStyle,
  channelMention,
  codeBlock,
  Colors,
  ComponentType,
  LabelBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  PollData,
  roleMention,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailComponent,
  userMention,
} from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import config from "../config";
import {
  createCustomId,
  generateCustomId,
  parseCustomId,
} from "../utils/customIdUtils";
import {
  deleteDailyQuestion,
  getDailyQuestion,
  getDbGuild,
  incrementDailyQuestionCount,
  newDailyQuestion,
  setDailyQuestionMessageId,
  setDailyQuestionPromptId,
} from "../db/guilds";
import { channel } from "node:process";
import { appEmoji } from "../utils/emojiUtils";
import { client, dev_mode } from "..";
import { randomUUID } from "node:crypto";
import { answers, questions } from "../db/schema";
import { MySqlColumnBuilderWithAutoIncrement } from "drizzle-orm/mysql-core";
import { wouldYouRatherImage } from "../utils/canvasUtils";

export enum QuestionModes {
  WOULD_YOU_RATHER = "wyw",
  CLASSIC = "poll",
  DISCUSSION = "discussion",
}

export const modes = [
  {
    name: "🟥 Would You Rather 🟦",
    value: "wyw",
    enumValue: QuestionModes.WOULD_YOU_RATHER,
  },
  { name: "📊 Classic Poll", value: "poll", enumValue: QuestionModes.CLASSIC },
  {
    name: "💬 Discussion Prompt",
    value: "discussion",
    enumValue: QuestionModes.DISCUSSION,
  },
];

export interface Question {
  index: number;
  text: string;
  prompt?: string;
}

client.on(
  "expireDailyQuestion",
  async (
    question: typeof questions.$inferInsert,
    answersArr: (typeof answers.$inferInsert)[],
    modeId: string,
    guildId: string,
  ) => {
    let questionsArr: Question[] = answersArr.map((a) => ({
      index: a.index,
      text: a.answer_text,
    }));

    let mode = modeId as QuestionModes;

    console.log("EXPIRED EVENT", mode, question, answersArr);
    await updatePollMessage(
      guildId,
      null,
      mode,
      question.question_text,
      questionsArr,
    );
  },
);

client.on(
  "updateDailyQuestion",
  async (
    question: typeof questions.$inferInsert,
    answersArr: (typeof answers.$inferInsert)[],
    modeId: string,
    guildId: string,
  ) => {
    let questionsArr: Question[] = answersArr.map((a) => ({
      index: a.index,
      text: a.answer_text,
    }));

    let mode = modeId as QuestionModes;

    console.log("UPDATE EVENT", mode, question, answersArr);
    await updatePollMessage(
      guildId,
      null,
      mode,
      question.question_text,
      questionsArr,
    );
  },
);

async function updatePollMessage(
  guildId: string,
  senderId: string | null,
  mode: QuestionModes,
  prompt: string,
  questions: Question[],
): Promise<boolean> {
  try {
    let dbGuild = getDbGuild(guildId);
    let guild = await client.guilds.fetch(dbGuild.id);
    let questionChannel = guild.channels.cache.get(dbGuild.question_channel_id);
    let midnight = new Date();
    if (!dev_mode) {
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      midnight.setHours(midnight.getHours() + 4);
    } else {
      midnight = new Date(Date.now() + 60e3);
    }

    let questionId = randomUUID();
    let dbQuestion = getDailyQuestion(guildId);
    if (!dbQuestion)
      dbQuestion = newDailyQuestion(
        dbGuild.id,
        {
          guild_id: guildId,
          message_id: null,
          question_text: prompt,
          expires_at: midnight.getTime(),
          id: questionId,
          mode,
        },
        questions.map((q) => ({
          answer_text: q.text,
          index: q.index,
          question_id: questionId,
          votes: 0,
        })),
      );

    let questionMessage: Message<boolean> | null =
      (await (questionChannel as TextChannel).messages.fetch(
        dbQuestion.question.message_id,
      )) || null;
    switch (mode) {
      case QuestionModes.CLASSIC: {
        if (dbQuestion.question.active) {
          // create a poll
          let pollContainer = new TMComponentBuilder().setAccentColor(
            config.brand_color,
          );
          pollContainer.addHeadingWithSeparator(
            `${roleMention(config.roles.daily_questions)} #${dbGuild.total_daily_questions}\n-# ${senderId ? `From ${userMention(senderId)} | ` : ""}<t:${Math.floor(Date.now() / 1000)}:F>`,
            3,
          );

          pollContainer.addTextDisplay(`# Q: ${prompt}`);
          pollContainer.addSeparator(SeparatorSpacingSize.Small, true);

          for (const question of questions) {
            let isWinning =
              dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[0].index === question.index &&
              (dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[0]?.votes || 0) !== 0;
            let votes =
              dbQuestion.answers.find((a) => a.index === question.index)
                ?.votes || 0;
            pollContainer.addTextDisplay(
              question.prompt
                ? `# Q: ${question.prompt}`
                : `### \`${isWinning ? "🏆 " : ""}${votes} vote${votes === 1 ? "" : "s"}\` ${await appEmoji(client, `${question.index - 1}_`)} ${question.text}`,
            );
            pollContainer.addSeparator(
              SeparatorSpacingSize.Small,
              question.index - 1 === questions.length ||
                question.prompt !== undefined,
            );
          }

          let buttons = [];
          let buttons2 = [];

          for (const question of questions) {
            let isWinning =
              dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[0].index === question.index &&
              (dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[0]?.votes || 0) !== 0;
            let button = TMComponentBuilder.accessoryButton(
              ButtonStyle.Primary,
              // `Vote ${question.index - 1}`,
              isWinning ? "🏆" : "\u200B",
              null,
              { id: (await appEmoji(client, `${question.index - 1}_`)).id },
              parseCustomId(
                createCustomId({
                  interactionId: "dailyquestion",
                  action: `answer-${question.index}`,
                  command: "vote",
                  subcommand: `mode-${mode.toString()}`,
                }),
              ),
            );
            if (buttons.length < 5) {
              buttons.push(button);
            } else buttons2.push(button);
          }

          if (dbQuestion.question.active) {
            pollContainer.addTextDisplay("### Vote Below");
            pollContainer.addButtonActionRow(buttons);
            if (buttons2.length > 0) pollContainer.addButtonActionRow(buttons2);
            pollContainer.addSeparator(SeparatorSpacingSize.Small, false);
            pollContainer.addButtonActionRow([
              TMComponentBuilder.accessoryButton(
                ButtonStyle.Secondary,
                "View Voters",
                null,
                { id: (await appEmoji(client, "pausej")).id },
                parseCustomId(
                  createCustomId({
                    interactionId: "dailyquestion",
                    action: `${questionId}`,
                    command: "voters",
                    subcommand: `mode-${mode.toString()}`,
                  }),
                ),
              ),
            ]);
          }

          pollContainer.addSeparator();
          pollContainer.addTextDisplay(
            `-# Voting Ends <t:${Math.floor(dbQuestion.question.expires_at / 1000)}:R>! (<t:${Math.floor(dbQuestion.question.expires_at / 1000)}:t>)`,
          );

          if (questionChannel.isSendable()) {
            if (questionMessage && questionMessage.editable) {
              questionMessage
                .edit({
                  components: [pollContainer.buildContainer()],
                })
                .then(() => {
                  console.log("QUESTIONS (post-edit)", questions);
                  return true;
                })
                .catch((e) => {
                  return false;
                });
            } else {
              questionChannel
                .send({
                  flags: [MessageFlags.IsComponentsV2],
                  components: [pollContainer.buildContainer()],
                })
                .then((m) => {
                  setDailyQuestionMessageId(dbQuestion.question.id, m.id);
                  console.log("QUESTIONS", questions);
                  return true;
                })
                .catch((e) => {
                  return false;
                });
            }
          } else return false;
        } else {
          // inactive poll

          let pollContainer = new TMComponentBuilder().setAccentColor(
            config.brand_color,
          );
          pollContainer.addHeadingWithSeparator(
            `Daily Question #${dbGuild.total_daily_questions}\n-# ${senderId ? `From ${userMention(senderId)} | ` : " "}Sent <t:${Math.floor(Date.now() / 1000)}:F>`,
            3,
          );

          pollContainer.addTextDisplay(`# Q: ${prompt}`);
          pollContainer.addSeparator(SeparatorSpacingSize.Small, true);

          let sortedQuestions = questions.sort(
            (a, b) =>
              (dbQuestion.answers.find((an) => an.index === b.index)?.votes ||
                0) -
                dbQuestion.answers.find((an) => an.index === a.index)?.votes ||
              0,
          );

          let hasWinner = false;
          let winner: Question | null = null;
          let winnerVotes = 0;

          let hasRunnerUp = false;
          let runnerUp: Question | null = null;
          let runnerUpVotes = 0;

          for (const question of sortedQuestions) {
            let isWinning =
              dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[0].index === question.index &&
              (dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[0]?.votes || 0) !== 0;
            let isRunnerUp =
              dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[1].index === question.index &&
              (dbQuestion.answers.sort(
                (a, b) => (b?.votes || 0) - (a?.votes || 0),
              )[1]?.votes || 0) !== 0;
            let votes =
              dbQuestion.answers.find((a) => a.index === question.index)
                ?.votes || 0;

            if (isWinning) {
              hasWinner = true;
              winner = question;
              winnerVotes = votes;
            }

            if (isRunnerUp) {
              hasRunnerUp = true;
              runnerUp = question;
              runnerUpVotes = votes;
            }

            pollContainer.addTextDisplay(
              question.prompt
                ? `# Q: ${question.prompt}`
                : `### ${isWinning ? "🏆 " : isRunnerUp ? "🥈" : ""} \`${votes} vote${votes === 1 ? "" : "s"}\` ${question.text}`,
            );
            pollContainer.addSeparator(
              SeparatorSpacingSize.Small,
              question.index - 1 === questions.length ||
                question.prompt !== undefined,
            );
          }

          if (!hasWinner) {
            pollContainer.addTextDisplay(
              `### There was no winner ${await appEmoji(client, "noooo")}`,
            );
            pollContainer.addSeparator(SeparatorSpacingSize.Large, false);
          }

          pollContainer.addTextDisplay(
            `**Voting Ended <t:${Math.floor(Date.now() / 1000)}:R>**`,
          );

          if (questionChannel.isSendable()) {
            if (questionMessage && questionMessage.editable) {
              if (
                dbQuestion.question.active &&
                dbQuestion.question.prompt_id !== null
              )
                questionMessage
                  .edit({
                    components: [pollContainer.buildContainer()],
                  })
                  .then(async () => {
                    console.log("QUESTIONS (post-edit, expired)", questions);
                    if (hasWinner && winner) {
                      let winnerContainer =
                        new TMComponentBuilder().setAccentColor(Colors.Yellow);
                      winnerContainer.addTextDisplay(
                        `-# Daily Question #${dbGuild.total_daily_questions}: "**${dbQuestion.question.question_text}**"`,
                      );
                      winnerContainer.addTextDisplay(
                        `### ${await appEmoji(client, "jiggy")} We Have a Winner!`,
                      );
                      winnerContainer.addSeparator();
                      winnerContainer.addTextDisplay(
                        `## 🏆 ${winner.text} (${winnerVotes} vote${winnerVotes === 1 ? "" : "s"})`,
                      );
                      if (hasRunnerUp && runnerUp) {
                        winnerContainer.addTextDisplay(
                          `-# Runner-Up\n### 🥈 ${runnerUp.text} (${runnerUpVotes} vote${runnerUpVotes === 1 ? "" : "s"})`,
                        );
                      }

                      await questionChannel.send({
                        flags: [MessageFlags.IsComponentsV2],
                        components: [winnerContainer.buildContainer()],
                      });
                    }
                    return true;
                  })
                  .catch((e) => {
                    return false;
                  });
            } else {
              questionChannel
                .send({
                  flags: [MessageFlags.IsComponentsV2],
                  components: [pollContainer.buildContainer()],
                })
                .then((m) => {
                  setDailyQuestionMessageId(dbQuestion.question.id, m.id);
                  setDailyQuestionPromptId(dbQuestion.question.id, m.id);

                  console.log("QUESTIONS", questions);
                  return true;
                })
                .catch((e) => {
                  return false;
                });
            }
          } else return false;
        }
        break;
      }
      case QuestionModes.DISCUSSION: {
        let promptChannel = guild.channels.cache.get(
          dbGuild.discussion_channel_id,
        );
        let discussionPrompt = dbQuestion.question.question_text;
        let discussionContainer = new TMComponentBuilder().setAccentColor(
          config.brand_color,
        );
        discussionContainer.addHeadingWithSeparator(
          `Daily Question #${dbGuild.total_daily_questions}\n-# ${senderId ? `From ${userMention(senderId)} | ` : ""}<t:${Math.floor(Date.now() / 1000)}:F>`,
          3,
        );
        discussionContainer.addTextDisplay(
          `### ${modes.find((m) => m.enumValue === mode).name}\n${blockQuote(`${discussionPrompt}`)}`,
        );
        discussionContainer.addTextDisplay(
          dbQuestion.question.active
            ? `Discuss this topic in ${channelMention(promptChannel.id)}!`
            : "Discussion has ended",
        );
        if (dbQuestion.question.active) {
          discussionContainer.addSeparator();
          discussionContainer.addButtonActionRow([
            TMComponentBuilder.accessoryButton(
              ButtonStyle.Link,
              "Discuss Topic",
              promptChannel.url,
            ),
          ]);
        }

        if (questionChannel.isSendable()) {
          if (questionMessage && questionMessage.editable) {
            questionMessage
              .edit({
                components: [discussionContainer.buildContainer()],
              })
              .then(() => {
                return true;
              })
              .catch((e) => {
                return false;
              });
          } else {
            if (dbQuestion.question.active)
              questionChannel
                .send({
                  flags: [MessageFlags.IsComponentsV2],
                  components: [discussionContainer.buildContainer()],
                })
                .then(async (m) => {
                  setDailyQuestionMessageId(dbQuestion.question.id, m.id);
                  if (promptChannel.isSendable()) {
                    let promptM = await promptChannel.send({
                      content: `-# ${roleMention(config.roles.daily_questions)} #${dbGuild.total_daily_questions}\n## ${modes.find((m) => m.enumValue === mode).name}\n${codeBlock(`${discussionPrompt}`)}\n-# Reply to this message with your thoughts!`,
                    });
                    setDailyQuestionPromptId(
                      dbQuestion.question.id,
                      promptM.id,
                    );
                  }

                  return true;
                })
                .catch((e) => {
                  return false;
                });
          }
        }
      }
      case QuestionModes.WOULD_YOU_RATHER: {
        console.log("OPTIONS", questions);
        let dbAnswers = getDailyQuestion(dbQuestion.question.guild_id).answers;
        const image = await wouldYouRatherImage(
          dbGuild.total_daily_questions,
          dbAnswers,
        );

        const wywContainer = new TMComponentBuilder();
        wywContainer.addHeadingWithSeparator(
          `${roleMention(config.roles.daily_questions)} #${dbGuild.total_daily_questions}\n-# ${senderId ? `From ${userMention(senderId)} | ` : ""}<t:${Math.floor(Date.now() / 1000)}:F>`,
          3,
        );

        wywContainer.addTextDisplay(`# 🟥 Would you Rather 🟦`);
        wywContainer.addSeparator(SeparatorSpacingSize.Small, false);

        wywContainer.addMediaGallery([
          { media: { url: `attachment://${image.attachment.name}` } },
        ]);

        wywContainer.addSeparator();

        if (dbQuestion.question.active) {
          wywContainer.addTextDisplay("### Vote Below");

          let buttons = [];

          for (const answer of questions) {
            buttons.push(
              TMComponentBuilder.accessoryButton(
                answer.index === 1 ? ButtonStyle.Danger : ButtonStyle.Primary,
                answer.text,
                null,
                null,
                parseCustomId(
                  createCustomId({
                    interactionId: "dailyquestion",
                    action: `answer-${answer.index}`,
                    command: "vote",
                    subcommand: `mode-${mode.toString()}`,
                  }),
                ),
              ),
            );
          }
          wywContainer.addButtonActionRow(buttons);
          wywContainer.addSeparator(SeparatorSpacingSize.Small, false);
          wywContainer.addButtonActionRow([
            TMComponentBuilder.accessoryButton(
              ButtonStyle.Secondary,
              "View Voters",
              null,
              { id: (await appEmoji(client, "pausej")).id },
              parseCustomId(
                createCustomId({
                  interactionId: "dailyquestion",
                  action: `${questionId}`,
                  command: "voters",
                  subcommand: `mode-${mode.toString()}`,
                }),
              ),
            ),
          ]);
          wywContainer.addSeparator();
        }
        wywContainer.addTextDisplay(
          `-# Voting End${dbQuestion.question.active ? "s" : "ed"} <t:${Math.floor(dbQuestion.question.expires_at / 1000)}:R>! (<t:${Math.floor(dbQuestion.question.expires_at / 1000)}:t>)`,
        );

        if (questionChannel.isSendable()) {
          if (questionMessage && questionMessage.editable) {
            questionMessage
              .edit({
                components: [wywContainer.buildContainer()],
                files: [image.attachment],
              })
              .then(() => {
                return true;
              })
              .catch((e) => {
                return false;
              });
          } else {
            if (dbQuestion.question.active)
              questionChannel
                .send({
                  flags: [MessageFlags.IsComponentsV2],
                  components: [wywContainer.buildContainer()],
                  files: [image.attachment],
                })
                .then(async (m) => {
                  setDailyQuestionMessageId(dbQuestion.question.id, m.id);

                  return true;
                })
                .catch((e) => {
                  return false;
                });
          }
        }
      }

      default: {
        return false;
      }
    }
  } catch (e) {
    console.log("Failed to update poll message", e);
  }
}

async function sendDailyQuestion(
  guildId: string,
  senderId: string,
  mode: QuestionModes,
  questions: Question[],
  message: string = "NO MESSAGE",
): Promise<boolean> {
  console.log("MESSAGE", message);
  incrementDailyQuestionCount(guildId);

  try {
    let promptQuestion = questions.find(
      (q) => q.text.trim() !== "" && q.index === 1,
    );
    if (mode !== QuestionModes.WOULD_YOU_RATHER)
      questions = questions.filter(
        (q) => q.text.trim() !== "" && q.index !== 1,
      );

    let questionId = randomUUID();
    let midnight = new Date();
    if (!dev_mode) {
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      midnight.setHours(midnight.getHours() + 4);
    } else {
      midnight = new Date(Date.now() + 60e3);
    }

    newDailyQuestion(
      guildId,
      {
        guild_id: guildId,
        message_id: null,
        question_text: promptQuestion.text,
        expires_at: midnight.getTime(),
        id: questionId,
        mode,
      },
      questions.map((q) => ({
        answer_text: q.text,
        index: q.index,
        question_id: questionId,
        votes: 0,
      })),
    );

    await updatePollMessage(
      guildId,
      senderId,
      mode,
      promptQuestion.text,
      questions,
    );

    return true;
  } catch (e) {
    console.log("FAILURE", e);
    return false;
  }
}

let preppers = new Set<string>();

const DailyCommand: Command = {
  enabled: true,
  name: "daily",
  description: "Manage the daily question!",
  category: CommandCategory.ADMIN,
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  options: [
    {
      name: "send",
      description: "Send the daily question",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "mode",
          description: "Which type of question do you want to send?",
          type: ApplicationCommandOptionType.String,
          choices: modes.map((m) => ({ name: m.name, value: m.value })),
          required: true,
        },
      ],
    },
    {
      name: "cancel",
      description: "Cancel the daily question",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  run: async (interaction) => {
    let subcommand = interaction.options.getSubcommand(true);

    if (subcommand === "cancel") {
      let dbGuild = getDbGuild(interaction.guildId);
      let dbQuestion = getDailyQuestion(dbGuild.id);

      let expirationMs = 60e3;
      let expiresAt = Math.floor((Date.now() + expirationMs) / 1000);

      let errorContainer = (
        cancelled: boolean = false,
        error: string | null = null,
      ): TMComponentBuilder => {
        return new TMComponentBuilder()
          .setAccentColor(Colors.Red)
          .addTextDisplay(
            `${error ? `## An Error Occurred\n${error}` : `## Interaction ${cancelled ? "Cancelled" : "Expired\nThis interaction has expired. Please run the command again."}`}`,
          );
      };

      if (!dbQuestion || !dbQuestion.question.active)
        return interaction.reply({
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          components: [
            errorContainer(
              true,
              "There is no current daily question",
            ).buildContainer(),
          ],
        });

      let confirmContainer = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      confirmContainer.addTextDisplay(
        `## Please Confirm\n### Would you like to delete daily question **#${dbGuild.total_daily_questions}**?\n\n-# Press "Confirm" to continue. | This interaction expires <t:${expiresAt}:R>`,
      );
      confirmContainer.addButtonActionRow([
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Success,
          "Confirm",
          null,
          null,
          parseCustomId(generateCustomId(interaction, "confirm-delete")),
        ),
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Danger,
          "Cancel",
          null,
          null,
          parseCustomId(generateCustomId(interaction, "cancel-delete")),
        ),
      ]);

      let confirmReply = await interaction.reply({
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        components: [confirmContainer.buildContainer()],
        withResponse: true,
      });

      let confirmInt: ButtonInteraction | null;
      confirmInt = await confirmReply.resource.message
        .awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === interaction.user.id,
          time: expirationMs,
        })
        .catch(() => (confirmInt = null));

      if (!confirmInt) {
        await interaction.editReply({
          components: [errorContainer().buildContainer()],
        });
      } else {
        if (confirmInt.customId.includes("cancel-delete")) {
          await interaction.editReply({
            components: [errorContainer(true).buildContainer()],
          });
        }

        if (confirmInt.customId.includes("confirm-delete")) {
          deleteDailyQuestion(interaction.guildId)
            .then(async () => {
              await interaction.editReply({
                components: [
                  new TMComponentBuilder()
                    .setAccentColor(Colors.Green)
                    .addTextDisplay(
                      `## Question Deleted\nSuccessfully deleted daily question **#${dbGuild.total_daily_questions}**`,
                    )
                    .buildContainer(),
                ],
              });
            })
            .catch(async (e) => {
              await interaction.editReply({
                components: [
                  errorContainer(
                    true,
                    `Something went wrong. Please try again.\n${codeBlock(e)}`,
                  ).buildContainer(),
                ],
              });
            });
        }
      }
    }

    if (subcommand === "send") {
      let dbGuild = getDbGuild(interaction.guildId);
      let modeId = interaction.options.getString("mode", true);
      let modeReadable = modes.find((m) => m.value === modeId).name;

      let expirationMs = 60e3;
      let expiresAt = Math.floor((Date.now() + expirationMs) / 1000);

      let expiredContainer = (
        cancelled: boolean = false,
      ): TMComponentBuilder => {
        return new TMComponentBuilder()
          .setAccentColor(Colors.Red)
          .addTextDisplay(
            `## Interaction ${cancelled ? "Cancelled" : "Expired\nThis interaction has expired. Please run the command again."}`,
          );
      };

      if (preppers.has(interaction.user.id))
        return interaction.reply({
          flags: [MessageFlags.Ephemeral],
          content: `${await appEmoji(interaction.client, "nono")} You are already preparing a question.`,
        });
      preppers.add(interaction.user.id);

      let confirmContainer = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      confirmContainer.addTextDisplay(
        `## Please Confirm\n### ${modeReadable}\nWould you like to prepare this question to send in ${channelMention(dbGuild.question_channel_id)}?${modeId === "discussion" ? `\n-# A discussion prompt will also be sent in ${channelMention(dbGuild.discussion_channel_id)}` : ""}\n\n-# Press "Confirm" to continue. | This interaction expires <t:${expiresAt}:R>`,
      );
      confirmContainer.addButtonActionRow([
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Success,
          "Confirm",
          null,
          null,
          parseCustomId(generateCustomId(interaction, "confirm-setup")),
        ),
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Danger,
          "Cancel",
          null,
          null,
          parseCustomId(generateCustomId(interaction, "cancel-setup")),
        ),
      ]);

      let confirmReply = await interaction.reply({
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        components: [confirmContainer.buildContainer()],
        withResponse: true,
      });
      let confirmInt: ButtonInteraction | null;
      confirmInt = await confirmReply.resource.message
        .awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === interaction.user.id,
          time: expirationMs,
        })
        .catch(() => (confirmInt = null));

      if (!confirmInt) {
        await interaction.editReply({
          components: [expiredContainer().buildContainer()],
        });

        preppers.delete(interaction.user.id);
      } else {
        let action = parseCustomId(confirmInt.customId).action;
        if (action === "cancel-setup") {
          await interaction.editReply({
            components: [expiredContainer(true).buildContainer()],
          });

          preppers.delete(interaction.user.id);
        } else if (action === "confirm-setup") {
          // continue
          let mode = modes.find((m) => m.value === modeId).enumValue;

          let allowedQuestions = 2;
          if (mode === QuestionModes.CLASSIC) allowedQuestions = 4;
          if (mode === QuestionModes.DISCUSSION) allowedQuestions = 1;

          let modal = new ModalBuilder()
            .setCustomId(generateCustomId(interaction, "modal"))
            .setTitle(`Preparing ${modeReadable}`);

          let modalExpirationMs = 300e3;
          let modalExpiresAt = Math.floor(
            (Date.now() + modalExpirationMs) / 1000,
          );

          modal.addTextDisplayComponents(
            TMComponentBuilder.textDisplay(
              `Interaction Expires <t:${modalExpiresAt}:R>`,
            ),
          );

          for (var i = 0; i < allowedQuestions; i++) {
            let labelText = `Question #${i + 1} of ${allowedQuestions}`;
            if (mode === QuestionModes.DISCUSSION)
              labelText = `Discussion Prompt`;
            if (mode === QuestionModes.CLASSIC && i === 0) {
              labelText = `Poll Question`;
            } else if (mode === QuestionModes.CLASSIC)
              labelText = `Answer #${i} of ${allowedQuestions - 1}`;
            if (mode === QuestionModes.WOULD_YOU_RATHER)
              labelText = `${i + 1 === 1 ? "🟥" : "🟦"} Option #${i + 1} of ${allowedQuestions}`;
            let label = new LabelBuilder().setLabel(labelText);
            let textInput = new TextInputBuilder().setCustomId(
              generateCustomId(interaction, `modal-question-${i}`),
            );

            if (mode === QuestionModes.DISCUSSION) {
              label.setDescription(
                "The prompt should spark thoughtful discussion, or it could even be controversial!",
              );
              textInput.setMaxLength(200);
            } else textInput.setMaxLength(30);
            if (mode === QuestionModes.CLASSIC) {
              textInput.setRequired(true);
            } else textInput.setRequired(true);

            textInput.setStyle(
              mode === QuestionModes.DISCUSSION
                ? TextInputStyle.Paragraph
                : TextInputStyle.Short,
            );
            label.setTextInputComponent(textInput);

            modal.addLabelComponents(label);
            if (mode === QuestionModes.DISCUSSION) {
              modal.addTextDisplayComponents(
                TMComponentBuilder.textDisplay(
                  `-# ${await appEmoji(interaction.client, "alert")} Make sure to include some kind of question or opposing viewpoint in your prompt to start the conversation!`,
                ),
              );
            }
          }

          let modalInt: ModalSubmitInteraction | null;
          await confirmInt.showModal(modal, { withResponse: true });
          let followModalContainer = new TMComponentBuilder()
            .setAccentColor(Colors.Yellow)
            .addTextDisplay(
              "### Please follow the instructions in the popup to continue.",
            );
          await interaction.editReply({
            components: [followModalContainer.buildContainer()],
          });

          confirmInt
            .awaitModalSubmit({ time: modalExpirationMs })
            .then(async (int) => {
              modalInt = int;

              if (!modalInt) {
                await interaction.editReply({
                  components: [expiredContainer().buildContainer()],
                });
              } else {
                let fields = modalInt.fields;
                if (fields.fields.size <= 0)
                  return await modalInt.reply({
                    flags: [
                      MessageFlags.Ephemeral,
                      MessageFlags.IsComponentsV2,
                    ],
                    components: [expiredContainer(true).buildContainer()],
                  });

                let i = 0;
                let questions: Question[] = fields.fields.map((v, k, c) => {
                  i++;
                  let textValue = modalInt.fields.getTextInputValue(v.customId);
                  let toReturn: Question = {
                    index: i,
                    text: textValue,
                  };
                  if (mode === QuestionModes.DISCUSSION)
                    toReturn.prompt = textValue;
                  if (mode === QuestionModes.CLASSIC && i === 1)
                    toReturn.prompt = textValue;
                  return toReturn;
                });

                console.log("modal submit | mode", mode);

                if (mode === QuestionModes.CLASSIC) {
                  expiresAt = Math.floor((Date.now() + expirationMs) / 1000);
                  let moreQuestionsCont = new TMComponentBuilder()
                    .setAccentColor(config.brand_color)
                    .addTextDisplay(
                      `### Would you like to add more questions?\n-# Interaction Expires (and the poll will be sent anyway) <t:${expiresAt}:R>`,
                    );
                  moreQuestionsCont.addButtonActionRow([
                    TMComponentBuilder.accessoryButton(
                      ButtonStyle.Success,
                      "Yes",
                      null,
                      null,
                      parseCustomId(
                        generateCustomId(interaction, `confirm-more-questions`),
                      ),
                    ),
                    TMComponentBuilder.accessoryButton(
                      ButtonStyle.Danger,
                      "No",
                      null,
                      null,
                      parseCustomId(
                        generateCustomId(interaction, `deny-more-questions`),
                      ),
                    ),
                  ]);
                  let moreQuestionsReply = await modalInt.reply({
                    flags: [
                      MessageFlags.Ephemeral,
                      MessageFlags.IsComponentsV2,
                    ],
                    components: [moreQuestionsCont.buildContainer()],
                    withResponse: true,
                  });
                  let moreQuestionsInt: ButtonInteraction | null;
                  moreQuestionsInt = await moreQuestionsReply.resource.message
                    .awaitMessageComponent({
                      componentType: ComponentType.Button,
                      filter: (i) => i.user.id === modalInt.user.id,
                    })
                    .catch(() => (moreQuestionsInt = null));

                  if (
                    !moreQuestionsInt ||
                    (moreQuestionsInt &&
                      moreQuestionsInt.customId.includes("deny-more-questions"))
                  ) {
                    // send anyway
                    await modalInt.editReply({
                      components: [
                        new TMComponentBuilder()
                          .setAccentColor(Colors.Green)
                          .addTextDisplay(`### Sending Daily Question...`)
                          .buildContainer(),
                      ],
                    });

                    await sendDailyQuestion(
                      interaction.guildId,
                      interaction.user.id,
                      mode,
                      questions,
                    );
                  } else if (
                    moreQuestionsInt.customId.includes("confirm-more-questions")
                  ) {
                    // show extended answer modal
                    modalExpiresAt = Math.floor(
                      (Date.now() + modalExpirationMs) / 1000,
                    );
                    let moreModal = new ModalBuilder()
                      .setCustomId(generateCustomId(interaction, "more-modal"))
                      .setTitle(`Preparing ${modeReadable}`);
                    moreModal.addTextDisplayComponents(
                      TMComponentBuilder.textDisplay(
                        `Add More Answers\n-# Interaction Expires <t:${modalExpiresAt}:R>`,
                      ),
                    );

                    let pickupIndex = 4;
                    let extraQuestions = 4;

                    for (
                      var ii = pickupIndex;
                      ii < pickupIndex + extraQuestions;
                      ii++
                    ) {
                      let label = new LabelBuilder();
                      label.setLabel(
                        `Answer #${ii} of ${pickupIndex + extraQuestions - 1}`,
                      );
                      let input = new TextInputBuilder().setCustomId(
                        generateCustomId(interaction, `more-modal-${ii}`),
                      );
                      input.setStyle(TextInputStyle.Short);
                      input.setMaxLength(30);
                      input.setRequired(ii === pickupIndex);
                      label.setTextInputComponent(input);
                      moreModal.addLabelComponents(label);
                    }

                    await moreQuestionsInt.showModal(moreModal, {
                      withResponse: true,
                    });
                    moreQuestionsInt
                      .awaitModalSubmit({
                        time: modalExpirationMs,
                        filter: (i) => i.user.id === moreQuestionsInt.user.id,
                      })
                      .then(async (moreQuestionsModal) => {
                        console.log("more modal submitted");
                        if (moreQuestionsModal.fields.fields.size <= 0) {
                          console.log("size trip");
                          let replyInt = moreQuestionsModal
                            ? moreQuestionsModal
                            : moreQuestionsInt;
                          await replyInt.reply({
                            flags: [MessageFlags.Ephemeral],
                            components: [
                              new TMComponentBuilder()
                                .setAccentColor(Colors.Green)
                                .addTextDisplay(`### Sending Daily Question...`)
                                .buildContainer(),
                            ],
                          });

                          await sendDailyQuestion(
                            interaction.guildId,
                            moreQuestionsModal.user.id,
                            mode,
                            questions,
                            "more questions modal had 0 fields",
                          );

                          return;
                        }

                        console.log("past time trip");

                        try {
                          let moreFields = moreQuestionsModal.fields;
                          i = pickupIndex;
                          questions = [
                            ...questions,
                            ...moreFields.fields.map((v, k, c) => {
                              i++;
                              let textValue = moreFields.getTextInputValue(
                                v.customId,
                              );
                              let toReturn: Question = {
                                index: i,
                                text: textValue,
                              };
                              if (mode === QuestionModes.CLASSIC && i === 1)
                                toReturn.prompt = textValue;
                              return toReturn;
                            }),
                          ];

                          await moreQuestionsModal.reply({
                            flags: [
                              MessageFlags.Ephemeral,
                              MessageFlags.IsComponentsV2,
                            ],
                            components: [
                              new TMComponentBuilder()
                                .setAccentColor(Colors.Green)
                                .addTextDisplay(`### Sending Daily Question...`)
                                .buildContainer(),
                            ],
                          });

                          console.log("trying to send poll");

                          await sendDailyQuestion(
                            moreQuestionsModal.guildId,
                            moreQuestionsModal.user.id,
                            mode,
                            questions,
                            "more questions final",
                          );
                        } catch (err) {
                          console.log("error", err);
                        }
                      })
                      .catch(async () => {
                        try {
                          await moreQuestionsInt.reply({
                            flags: [MessageFlags.Ephemeral],
                            components: [
                              new TMComponentBuilder()
                                .setAccentColor(Colors.Green)
                                .addTextDisplay(`### Sending Daily Question...`)
                                .buildContainer(),
                            ],
                          });

                          await sendDailyQuestion(
                            interaction.guildId,
                            interaction.user.id,
                            mode,
                            questions,
                            "more modal catch",
                          );
                        } catch (e) {}
                      });
                  }
                } else {
                  await modalInt.reply({
                    flags: [
                      MessageFlags.Ephemeral,
                      MessageFlags.IsComponentsV2,
                    ],
                    components: [
                      new TMComponentBuilder()
                        .setAccentColor(Colors.Green)
                        .addTextDisplay(`### Sending Daily Question...`)
                        .buildContainer(),
                    ],
                  });

                  let success = await sendDailyQuestion(
                    interaction.guildId,
                    interaction.user.id,
                    mode,
                    questions,
                    "file final",
                  );
                }
              }
            })
            .catch(() => (modalInt = null));

          // let success = await sendDailyQuestion(interaction.guildId, mode);

          preppers.delete(interaction.user.id);
        }
      }
    }
  },
};

export default DailyCommand;
