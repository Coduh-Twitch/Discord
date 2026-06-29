import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  BaseInteraction,
  blockQuote,
  ButtonInteraction,
  ChatInputCommandInteraction,
  codeBlock,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  roleMention,
  userMention,
} from "discord.js";
import { join } from "path";
import { desiredExt, dev_mode } from "..";
import { twitchCustomCommandModel } from "../models/twitchCustomCommand";
import { existsSync } from "fs-extra";
import config from "../config";
import { TemporaryFile } from "../classes/TemporaryFile";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { parseCustomId } from "../utils/customIdUtils";
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
                answer.votes !== 0;
              let isRunnerUp =
                dbQuestion.answers[1].index === answer.index &&
                answer.votes !== 0;
              console.log("VOTERS (FILT)", filteredVoters);
              votesCont.addTextDisplay(
                `### \`${isWinning ? "🏆 " : isRunnerUp ? "🥈 " : ""}${answer.votes}\` ${answer.answer_text}\n${filteredVoters.map((v) => `- ${userMention(v.user_id)}`).join("\n")}`,
              );
              votesCont.addSeparator();
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
