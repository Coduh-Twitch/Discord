import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  BaseInteraction,
  blockQuote,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  codeBlock,
  Colors,
  ComponentType,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  roleMention,
  SeparatorSpacingSize,
  TextChannel,
  userMention,
} from "discord.js";
import { join } from "path";
import { client, desiredExt, dev_mode } from "..";
import { twitchCustomCommandModel } from "../models/twitchCustomCommand";
import { existsSync } from "fs-extra";
import config from "../config";
import { TemporaryFile } from "../classes/TemporaryFile";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { generateCustomId, parseCustomId } from "../utils/customIdUtils";
import { appEmoji } from "../utils/emojiUtils";
import { Command, UserLevel } from "../classes/Command";
import {
  addVoter,
  getAllVoters,
  getDailyQuestion,
  getDbGuild,
} from "../db/guilds";
import { voters } from "../db/schema";
import { modes, QuestionModes } from "../commands/daily";
import {
  deleteReminder,
  getAllDmUsers,
  getDbReminder,
  subscribeUser,
  unSubscribeUser,
} from "../utils/reminderUtils";

let roleReactors: Map<string, string> = new Map<string, string>();
let roleReactCooldown = 3e3;

export default {
  enabled: true,
  run: async (int: BaseInteraction) => {
    async function handleSlashCommand(
      interaction: ChatInputCommandInteraction,
    ) {
      console.log("IS DEV MODE", dev_mode);
      if (interaction.commandName && interaction.commandName !== null) {
        let path = dev_mode
          ? join(
              process.cwd(),
              `src`,
              "commands",
              `${interaction.commandName}${desiredExt}`,
            )
          : join(
              process.cwd(),
              `dist`,
              `src`,
              "commands",
              `${interaction.commandName}${desiredExt}`,
            );
        console.log("PATH", path);
        console.log("EXISTS", existsSync(path));
        if (existsSync(path)) {
          let ran = false;
          const cmd: Command = require(
            `../commands/${interaction.commandName}${desiredExt}`,
          ).default;
          let member = interaction.guild.members.cache.get(interaction.user.id);
          if (cmd && cmd.enabled && cmd.run) {
            let subcommand = interaction.options.getSubcommand(false);
            let subcommandOption = subcommand
              ? cmd.options.find(
                  (o) =>
                    o.type === ApplicationCommandOptionType.Subcommand &&
                    o.name === subcommand,
                )
              : null;
            if (cmd.requiredRole && cmd.requiredRole !== UserLevel.DEFAULT) {
              if (
                ![UserLevel.ADMIN, UserLevel.DEV].includes(cmd.requiredRole) &&
                member.permissions.has(
                  PermissionFlagsBits.ModerateMembers,
                  true,
                )
              )
                return await cmd.run(interaction);
              if (
                cmd.requiredRole === UserLevel.VIP ||
                (subcommandOption &&
                  subcommandOption.requiredRole === UserLevel.VIP &&
                  (!member.roles.cache.has(config.roles.vip) ||
                    !member.permissions.has(
                      PermissionFlagsBits.ModerateMembers,
                      true,
                    )))
              )
                return await interaction.reply({
                  flags: [MessageFlags.Ephemeral],
                  content: `${await appEmoji(interaction.client, "nono")} You need the ${roleMention(config.roles.vip)} role to do that command.`,
                });
              await cmd.run(interaction);
            } else if (
              subcommandOption &&
              subcommandOption.requiredRole !== UserLevel.DEFAULT
            ) {
              if (
                ![UserLevel.ADMIN, UserLevel.DEV].includes(
                  subcommandOption.requiredRole,
                ) &&
                member.permissions.has(
                  PermissionFlagsBits.ModerateMembers,
                  true,
                )
              )
                return await cmd.run(interaction);
              if (
                subcommandOption &&
                subcommandOption.requiredRole === UserLevel.VIP &&
                !member.roles.cache.has(config.roles.vip)
              )
                return await interaction.reply({
                  flags: [MessageFlags.Ephemeral],
                  content: `${await appEmoji(interaction.client, "nono")} You need the ${roleMention(config.roles.vip)} role to do that command.`,
                });
              await cmd.run(interaction);
            } else await cmd.run(interaction);
          }
          return;
        } else {
          const customCmd = await twitchCustomCommandModel.findOne({
            trigger: `!${interaction.commandName}`,
          });

          if (customCmd) {
            interaction.reply({ content: customCmd.content });
          }
        }
      }
    }

    async function handleAutocomplete(
      autocompleteInteraction: AutocompleteInteraction,
    ) {
      let command = require(
        `../commands/${autocompleteInteraction.commandName}${desiredExt}`,
      ).default;
      if (!command || !command.name || !command.run || !command.enabled)
        return console.log(`Skipped autocomplete`);

      try {
        await command.autocomplete(autocompleteInteraction).catch((err) => {
          // handleError(autocompleteInteraction, err,);
        });
      } catch (e) {
        // handleError(autocompleteInteraction, e,);
      }
    }

    async function handleButtonPress(interaction: ButtonInteraction) {
      let parsedId = parseCustomId(interaction.customId);
      if (parsedId.action.startsWith("reminder-")) {
        let dbReminder = getDbReminder(parsedId.command);
        if (!dbReminder)
          return await interaction.reply({
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                "Failed to find the specified reminder.",
              ).buildContainer(),
            ],
          });
        let dmUsers = getAllDmUsers(dbReminder.id);

        if (parsedId.action === "reminder-subscribe") {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          try {
            if (
              dmUsers.some(
                (u) =>
                  u.reminder_id === dbReminder.id &&
                  u.user_id === interaction.user.id,
              )
            )
              return await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [
                  TMComponentBuilder.errorContainer(
                    true,
                    "You are already subscribed to this reminder.",
                  ).buildContainer(),
                ],
              });

            await subscribeUser(interaction.user.id, dbReminder.id);
            await interaction.editReply({
              flags: [MessageFlags.IsComponentsV2],
              components: [
                new TMComponentBuilder()
                  .setAccentColor(Colors.Green)
                  .addTextDisplay(`Subscribed to reminder \`${dbReminder.id}\``)
                  .buildContainer(),
              ],
            });
          } catch (e) {
            await interaction.editReply({
              flags: [MessageFlags.IsComponentsV2],
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  "Failed to subscribe to reminder.",
                ).buildContainer(),
              ],
            });
          }
        }

        if (parsedId.action === "reminder-unsubscribe") {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          try {
            if (
              !dmUsers.some(
                (u) =>
                  u.reminder_id === dbReminder.id &&
                  u.user_id === interaction.user.id,
              )
            )
              return await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [
                  TMComponentBuilder.errorContainer(
                    true,
                    "You are not subscribed to this reminder.",
                  ).buildContainer(),
                ],
              });

            await unSubscribeUser(interaction.user.id, dbReminder.id);
            await interaction.editReply({
              flags: [MessageFlags.IsComponentsV2],
              components: [
                new TMComponentBuilder()
                  .setAccentColor(Colors.Green)
                  .addTextDisplay(
                    `Unsubscribed from reminder \`${dbReminder.id}\``,
                  )
                  .buildContainer(),
              ],
            });
          } catch (e) {
            await interaction.editReply({
              flags: [MessageFlags.IsComponentsV2],
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  "Failed to unsubscribe from reminder.",
                ).buildContainer(),
              ],
            });
          }
        }

        if (parsedId.action === "reminder-delete") {
          const confirmResponse = await interaction.deferReply({
            flags: [MessageFlags.Ephemeral],
            withResponse: true,
          });

          if (!dbReminder)
            return interaction.editReply({
              flags: [, MessageFlags.IsComponentsV2],
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  `Reminder not found.`,
                ).buildContainer(),
              ],
            });

          let expirationMs = 60e3;
          let expiresAt = Math.floor((Date.now() + expirationMs) / 1000);

          const confirmCont = new TMComponentBuilder().setAccentColor(
            Colors.Yellow,
          );
          confirmCont.addTextDisplay(
            `## Confirm Reminder Deletion\nAre you sure you want to delete reminder with ID \`${dbReminder.id}\`?\n### Reminder Content\n${codeBlock(dbReminder.content)}\n\n-# Choose "Confirm" to continue | Interaction Expires <t:${expiresAt}:R>`,
          );
          confirmCont.addSeparator(SeparatorSpacingSize.Small, false);
          confirmCont.addButtonActionRow([
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

          await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [confirmCont.buildContainer()],
          });

          let confirmInt: ButtonInteraction | null;
          confirmInt = await confirmResponse.resource.message
            .awaitMessageComponent({
              componentType: ComponentType.Button,
              filter: (i) => i.user.id === interaction.user.id,
              time: expirationMs,
            })
            .catch(() => (confirmInt = null));

          if (!confirmInt) {
            return interaction.editReply({
              components: [
                TMComponentBuilder.errorContainer().buildContainer(),
              ],
            });
          } else {
            if (confirmInt.customId.includes("cancel-delete"))
              return interaction.editReply({
                components: [
                  TMComponentBuilder.errorContainer(true).buildContainer(),
                ],
              });

            let reminderChannel = interaction.guild.channels.cache.get(
              config.channels.reminders,
            ) as TextChannel;
            let reminderMessage =
              (await reminderChannel.messages.fetch(dbReminder.message_id)) ||
              null;

            try {
              if (reminderMessage && reminderMessage.deletable)
                await reminderMessage.delete();
              deleteReminder(dbReminder.id);
              client.emit("reminderDeleted", dbReminder, interaction.user);

              interaction.editReply({
                components: [
                  new TMComponentBuilder()
                    .setAccentColor(Colors.Green)
                    .addTextDisplay(
                      `Successfully deleted reminder \`${dbReminder.id}\``,
                    )
                    .buildContainer(),
                ],
              });
            } catch (e) {
              interaction.editReply({
                components: [
                  TMComponentBuilder.errorContainer(
                    true,
                    `Failed to delete reminder \`${dbReminder.id}\`\n${codeBlock(e)}`,
                  ).buildContainer(),
                ],
              });
            }
          }
        }
      }
      if (parsedId.interactionId === "dailyquestion") {
        if (parsedId.command === "voters") {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          let dbQuestion = getDailyQuestion(interaction.guildId);
          let dbGuild = getDbGuild(interaction.guildId);
          let dbVoters = getAllVoters(dbQuestion.question.id);
          let voterOptions: {
            [answerIndex: string]: (typeof voters.$inferInsert)[];
          } = {};

          let modeSplit = parsedId.subcommand.split("-")[1];
          let mode = modeSplit as QuestionModes;
          let modeReadable = modes.find((m) => m.value === modeSplit).name;

          for (const voter of dbVoters) {
            let answer = dbQuestion.answers.find(
              (a) => a.index === voter.vote_index,
            );
            let answerOption = voterOptions[`${answer.index}`];
            answerOption = [...(answerOption || []), voter];
          }

          let votesCont = new TMComponentBuilder().setAccentColor(
            config.brand_color,
          );

          votesCont.addHeadingWithSeparator(
            `Daily Question #${dbGuild.total_daily_questions} | ${modeReadable}\n-# Voter List`,
            3,
          );

          dbQuestion.answers = dbQuestion.answers.sort(
            (a, b) => b.votes - a.votes,
          );

          if (dbVoters.length > 0) {
            for (const answer of dbQuestion.answers) {
              let filteredVoters = dbVoters.filter(
                (v) => v.vote_index === answer.index,
              );
              let isWinning =
                dbQuestion.answers[0].index === answer.index &&
                answer.votes !== 0 &&
                dbQuestion.answers[0].votes !== dbQuestion.answers[1].votes;
              let isRunnerUp =
                dbQuestion.answers[1].index === answer.index &&
                answer.votes !== 0 &&
                dbQuestion.answers[0].votes !== dbQuestion.answers[1].votes;
              console.log("VOTERS (FILT)", filteredVoters);
              votesCont.addTextDisplay(
                `### \`${isWinning ? "🏆 " : isRunnerUp ? "🥈 " : ""}${answer.votes}\` ${answer.answer_text}\n${filteredVoters.map((v) => `- ${userMention(v.user_id)}${v.user_id === interaction.user.id ? ` **< YOU**` : ""}`).join("\n")}`,
              );
              votesCont.addSeparator(SeparatorSpacingSize.Small, false);
            }
          } else votesCont.addTextDisplay("No votes have been tallied yet.");

          await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [votesCont.buildContainer()],
          });
        }
        if (parsedId.command === "vote") {
          let split = parsedId.action.split("-")[1];
          let answerIndex: number | null = Number.isNaN(Number(split))
            ? null
            : Number(split);
          let modeSplit = parsedId.subcommand.split("-")[1];

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          let dbQuestion = getDailyQuestion(interaction.guildId);
          let dbAnswer = dbQuestion.answers.find(
            (a) => a.index === answerIndex || 0,
          );

          if (!dbQuestion)
            return await interaction.editReply({
              content: `${await appEmoji(interaction.client, "noooo")} Something went wrong and the question couldn't be found ${await appEmoji(interaction.client, "smokee")}`,
            });

          if (!answerIndex || !dbAnswer)
            return await interaction.editReply({
              content: `${await appEmoji(interaction.client, "noooo")} Something went wrong and the answer you chose couldn't be found ${await appEmoji(interaction.client, "smokee")}`,
            });

          let voter =
            getAllVoters(dbQuestion.question.id).find(
              (v) => v.user_id === interaction.user.id,
            ) || null;
          if (voter && voter.vote_index === answerIndex)
            return await interaction.editReply({
              content: `${await appEmoji(interaction.client, "nono")} You have already voted for "**${dbAnswer.answer_text}**"`,
            });

          addVoter(interaction.guildId, interaction.user.id, answerIndex);

          await interaction.editReply({
            content: `${await appEmoji(interaction.client, "yay")} ${voter ? "Switched vote to" : "Voted for"} "**${dbAnswer.answer_text}**"!`,
          });

          dbQuestion = getDailyQuestion(interaction.guildId);

          interaction.client.emit(
            "updateDailyQuestion",
            dbQuestion.question,
            dbQuestion.answers,
            modeSplit,
            interaction.guildId,
          );
        }
      }
      if (interaction.customId.includes("role-react")) {
        let customId = parseCustomId(interaction.customId);

        if (customId.action.startsWith("role-react")) {
          let actionSplit = customId.action.split("-");
          let roleId = actionSplit[actionSplit.length - 1];
          let member = interaction.guild.members.cache.get(interaction.user.id);
          let role = interaction.guild.roles.cache.get(roleId);

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          if (roleReactors.has(member.id))
            return interaction.editReply({
              content: `${await appEmoji(interaction.client, "nono")} Please wait a moment before pressing the button again.`,
            });

          if (member.roles.cache.has(roleId)) {
            try {
              member.roles.remove(roleId);
              await interaction.editReply({
                content: `Removed "${role.name}"!`,
              });
              roleReactors.set(member.id, role.id);
              setTimeout(() => {
                roleReactors.delete(member.id);
              }, roleReactCooldown);
            } catch (e) {
              console.log(e);
              await interaction.editReply({
                content: `${await appEmoji(interaction.client, "noooo")} Something went wrong while removing "${role.name}"\n\nPlease try again!`,
              });
            }
          } else {
            try {
              member.roles.add(roleId);
              await interaction.editReply({ content: `Added "${role.name}"!` });
              roleReactors.set(member.id, role.id);
              setTimeout(() => {
                roleReactors.delete(member.id);
              }, roleReactCooldown);
            } catch (e) {
              console.log(e);
              await interaction.editReply({
                content: `${await appEmoji(interaction.client, "noooo")} Something went wrong while adding "${role.name}"\n\nPlease try again!`,
              });
            }
          }
        }
      }

      if (interaction.customId === "show-diff") {
        let m = await interaction.channel.messages.fetch(
          interaction.message.id,
        );
        console.log(interaction.message.attachments);
        if (!m || m?.attachments?.size <= 0) return;
        console.log(m);
        const tempFile = await TemporaryFile.create(m.attachments.at(0).url);
        const np = tempFile.getBuffer().toString("utf8").split("\n").slice(5);
        let hp = "";
        let didCondense = false;

        const check = (line: string) =>
          line.startsWith("+") || line.startsWith("-");

        for (let index = 0; index < np.length; index++) {
          let prevLine = "";
          let nextLine = "";

          const line = np[index];
          if (index != 0) prevLine = np[index - 1];
          if (index + 1 < np.length) nextLine = np[index + 1];

          if (check(line)) {
            hp += line;
            hp += "\n";
            didCondense = false;
            continue;
          }
          if (check(nextLine)) {
            hp += line;
            hp += "\n";
            didCondense = false;
            continue;
          }
          if (check(prevLine)) {
            hp += line;
            hp += "\n";
            didCondense = false;
            continue;
          }
          if (!didCondense) {
            hp += " ...";
            hp += "\n";

            didCondense = true;
            continue;
          }
        }

        hp = codeBlock("diff", hp);

        let diffContainer = new TMComponentBuilder();
        diffContainer.addTextDisplay(`### Message Edited | Diff`);
        diffContainer.addTextDisplay(hp);

        await interaction.reply({
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          components: [diffContainer.buildContainer()],
        });
        tempFile.free();
      }
    }

    if (int.isChatInputCommand())
      await handleSlashCommand(int as ChatInputCommandInteraction);
    if (int.isButton()) await handleButtonPress(int as ButtonInteraction);
    if (int.isAutocomplete())
      await handleAutocomplete(int as AutocompleteInteraction);
  },
};
