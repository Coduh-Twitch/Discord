import {
  ApplicationCommandOptionType,
  blockQuote,
  channelMention,
  ChannelType,
  Colors,
  MessageFlags,
  PermissionFlagsBits,
  userMention,
} from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command";
import { DBUser, userModel } from "../models/user";
import {
  addXP,
  calculateRequiredXP,
  canLevelDown,
  canLevelUp,
  levelDown,
  levelUp,
} from "../utils/xpUtils";
import { Document } from "mongoose";
import config from "../config";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { getDbGuild, updateDbGuild } from "../db/guilds";

export const AdminCommand: Command = {
  enabled: true,
  category: CommandCategory.ADMIN,
  name: "admin",
  description: "Various administrative commands",
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  options: [
    {
      name: "xp",
      description: "XP Admin Tasks",
      type: ApplicationCommandOptionType.SubcommandGroup,
      requiredRole: UserLevel.ADMIN,
      options: [
        {
          name: "add",
          description: "Add XP to a user",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "user",
              description: "The user to add XP to",
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "amount",
              description: "The amount of XP to add",
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
          ],
        },
        {
          name: "remove",
          description: "Remove XP from a user",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "user",
              description: "The user to remove XP from",
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "amount",
              description: "The amount of XP to remove",
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
          ],
        },
        {
          name: "set",
          description: "Set the amount of XP a user has",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "user",
              description: "The user to set the XP of",
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "amount",
              description: "The amount of XP to set",
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: `${config.point_name(true, false)}s`,
      description: `${config.point_name()}s Admin Tasks`,
      requiredRole: UserLevel.ADMIN,
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: "add",
          description: `Add ${config.point_name(true)}s to a user`,
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "user",
              description: `The user to add ${config.point_name(true)}s to`,
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "amount",
              description: `The amount of ${config.point_name(true)}s to add`,
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
          ],
        },
        {
          name: "remove",
          description: `Remove ${config.point_name(true)}s from a user`,
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "user",
              description: `The user to remove ${config.point_name(true)}s from`,
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "amount",
              description: `The amount of ${config.point_name(true)}s to remove`,
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
          ],
        },
        {
          name: "set",
          description: `Set the amount of ${config.point_name(true)}s a user has`,
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "user",
              description: `The user to set the ${config.point_name(true)}s of`,
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "amount",
              description: `The amount of ${config.point_name(true)}s to set`,
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: "daily",
      description: "Manage daily question configuration",
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: "set-question-channel",
          description: "Set the channel in which all questions are sent",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "channel",
              description: "The channel to send questions to",
              type: ApplicationCommandOptionType.Channel,
              channelTypes: [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
              ],
              required: true,
            },
          ],
        },
        {
          name: "set-discussion-channel",
          description: "Set the channel in which discussion prompts are sent",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "channel",
              description: "The channel to send discussion prompts to",
              type: ApplicationCommandOptionType.Channel,
              channelTypes: [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
              ],
              required: true,
            },
          ],
        },
        {
          name: "reset-total-questions",
          description: "Set the total daily question counter back to 0",
          type: ApplicationCommandOptionType.Subcommand,
        },
      ],
    },
  ],
  run: async (interaction) => {
    let group = interaction.options.getSubcommandGroup(true);
    let subcommand = interaction.options.getSubcommand(true);

    switch (group) {
      case "daily": {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        switch (subcommand) {
          case "reset-total-questions": {
            let confirmedCont = new TMComponentBuilder()
              .setAccentColor(Colors.Green)
              .addTextDisplay(`Reset total question count`);

            try {
              updateDbGuild(interaction.guildId, {
                ...getDbGuild(interaction.guildId),
                total_daily_questions: 0,
              });

              await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [confirmedCont.buildContainer()],
              });
            } catch (e) {
              let failedCont = new TMComponentBuilder()
                .setAccentColor(Colors.Red)
                .addTextDisplay(`Failed to reset daily question count`);
              await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [failedCont.buildContainer()],
              });
            }
            break;
          }
          case "set-question-channel": {
            let channel = interaction.options.getChannel("channel", true);
            let confirmedCont = new TMComponentBuilder()
              .setAccentColor(Colors.Green)
              .addTextDisplay(
                `Daily questions will now be sent to ${channelMention(channel.id)}`,
              );

            try {
              updateDbGuild(interaction.guildId, {
                ...getDbGuild(interaction.guildId),
                question_channel_id: channel.id,
              });

              await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [confirmedCont.buildContainer()],
              });
            } catch (e) {
              let failedCont = new TMComponentBuilder()
                .setAccentColor(Colors.Red)
                .addTextDisplay(`Failed to set daily question channel`);
              await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [failedCont.buildContainer()],
              });
            }
            break;
          }
          case "set-discussion-channel": {
            let channel = interaction.options.getChannel("channel", true);
            let confirmedCont = new TMComponentBuilder()
              .setAccentColor(Colors.Green)
              .addTextDisplay(
                `Discussion prompts will now be sent to ${channelMention(channel.id)}`,
              );

            try {
              updateDbGuild(interaction.guildId, {
                ...getDbGuild(interaction.guildId),
                discussion_channel_id: channel.id,
              });

              await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [confirmedCont.buildContainer()],
              });
            } catch (e) {
              let failedCont = new TMComponentBuilder()
                .setAccentColor(Colors.Red)
                .addTextDisplay(`Failed to set discussion prompt channel`);
              await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2],
                components: [failedCont.buildContainer()],
              });
            }
            break;
          }
        }

        break;
      }
      case "xp": {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        switch (subcommand) {
          case "add": {
            let user = interaction.options.getUser("user", true);
            let amount = interaction.options.getNumber("amount", true);

            let dbUser = await userModel.findOne({ id: user.id });

            if (!dbUser) {
              let old_level = 0;
              let old_xp = 0;
              let new_xp = old_xp + amount;

              let newDbUser = new userModel({
                id: user.id,
                xp: new_xp,
                shownWelcomeMessage: true,
                favorite_movies: [],
                level: 0,
              });

              let doc: Document<DBUser> | DBUser = await newDbUser.save();

              if (canLevelUp(doc.level, doc.xp))
                doc = await levelUp(
                  interaction.guild.members.cache.get(doc.id),
                  doc.level,
                );

              await interaction.editReply({
                content: `Added ${amount.toLocaleString()} XP to ${userMention(user.id)}\n${blockQuote(`**XP** ~~${old_xp.toLocaleString()}~~ -> ${doc.xp.toLocaleString()} (+${(doc.xp - old_xp).toLocaleString()})\n\n**Level** ${doc.level === old_level ? "No Change" : `~~${old_level.toLocaleString()}~~ -> ${doc.level.toLocaleString()} (+${(doc.level - old_level).toLocaleString()})`}`)}`,
              });
            } else {
              let old_level = dbUser.level;
              let old_xp = dbUser.xp;
              let new_xp = old_xp + amount;
              dbUser.set("xp", new_xp);

              let doc: Document<DBUser> | DBUser = await dbUser.save();
              if (canLevelUp(doc.level, doc.xp))
                doc = await levelUp(
                  interaction.guild.members.cache.get(doc.id),
                  doc.level,
                );

              await interaction.editReply({
                content: `Added ${amount.toLocaleString()} XP to ${userMention(user.id)}\n${blockQuote(`**XP** ~~${old_xp.toLocaleString()}~~ -> ${doc.xp.toLocaleString()} (+${(doc.xp - old_xp).toLocaleString()})\n\n**Level** ${doc.level === old_level ? "No Change" : `~~${old_level.toLocaleString()}~~ -> ${doc.level.toLocaleString()} (+${(doc.level - old_level).toLocaleString()})`}`)}`,
              });
            }

            break;
          }

          case "remove": {
            let user = interaction.options.getUser("user", true);
            let amount = interaction.options.getNumber("amount", true);

            let dbUser = await userModel.findOne({ id: user.id });

            if (!dbUser) {
              await interaction.editReply({
                content: `Can not remove XP from ${userMention(user.id)} because they have 0 XP.`,
              });
            } else {
              if (dbUser.xp <= 0)
                return await interaction.editReply({
                  content: `Can not remove XP from ${userMention(user.id)} because they have 0 XP.`,
                });
              let old_level = dbUser.level;
              let old_xp = dbUser.xp;
              let new_xp = old_xp - amount;
              dbUser.set("xp", new_xp);

              let doc: Document<DBUser> | DBUser = await dbUser.save();
              if (canLevelDown(doc.level, doc.xp))
                doc = await levelDown(
                  interaction.guild.members.cache.get(doc.id),
                  doc.level,
                );

              await interaction.editReply({
                content: `Removed ${amount.toLocaleString()} XP from ${userMention(user.id)}\n${blockQuote(`**XP** ~~${old_xp.toLocaleString()}~~ -> ${doc.xp.toLocaleString()} (-${(old_xp - doc.xp).toLocaleString()})\n\n**Level** ${doc.level === old_level ? "No Change" : `~~${old_level.toLocaleString()}~~ -> ${doc.level.toLocaleString()} (-${(old_level - doc.level).toLocaleString()})`}`)}`,
              });
            }

            break;
          }

          case "set": {
            let user = interaction.options.getUser("user", true);
            let amount = interaction.options.getNumber("amount", true);

            let dbUser = await userModel.findOne({ id: user.id });

            if (!dbUser) {
              let old_level = 0;
              let old_xp = 0;
              let new_xp = amount;

              let newDbUser = new userModel({
                id: user.id,
                xp: new_xp,
                shownWelcomeMessage: true,
                favorite_movies: [],
                level: 0,
              });

              let doc: Document<DBUser> | DBUser = await newDbUser.save();

              if (canLevelUp(doc.level, doc.xp))
                doc = await levelUp(
                  interaction.guild.members.cache.get(doc.id),
                  doc.level,
                );

              await interaction.editReply({
                content: `Set ${userMention(user.id)}'s XP to ${amount.toLocaleString()}\n${blockQuote(`**XP** ~~${old_xp.toLocaleString()}~~ -> ${doc.xp.toLocaleString()}`)}`,
              });
            } else {
              let old_level = dbUser.level;
              let old_xp = dbUser.xp;
              let new_xp = amount;
              dbUser.set("xp", new_xp);

              let doc: Document<DBUser> | DBUser = await dbUser.save();
              if (canLevelUp(doc.level, doc.xp))
                doc = await levelUp(
                  interaction.guild.members.cache.get(doc.id),
                  doc.level,
                );

              await interaction.editReply({
                content: `Set ${userMention(user.id)}'s XP to ${amount.toLocaleString()}\n${blockQuote(`**XP** ~~${old_xp.toLocaleString()}~~ -> ${doc.xp.toLocaleString()}`)}`,
              });
            }

            break;
          }
        }

        break;
      }

      case `${config.point_name(true, false)}s`: {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        switch (subcommand) {
          case "add": {
            let user = interaction.options.getUser("user", true);
            let amount = interaction.options.getNumber("amount", true);

            let dbUser = await userModel.findOne({ id: user.id });

            if (!dbUser) {
              let old_points = 0;
              let new_points = old_points + amount;

              let newDbUser = new userModel({
                id: user.id,
                xp: 0,
                points: new_points,
                shownWelcomeMessage: true,
                favorite_movies: [],
                level: 0,
              });

              let doc: Document<DBUser> | DBUser = await newDbUser.save();

              await interaction.editReply({
                content: `Added ${amount.toLocaleString()} ${config.point_name(true)}${amount === 1 ? "" : "s"} to ${userMention(user.id)}\n${blockQuote(`**${config.point_name()}s** ~~${old_points.toLocaleString()}~~ -> ${doc.points.toLocaleString()} (+${(doc.points - old_points).toLocaleString()})`)}`,
              });
            } else {
              let old_points = dbUser.points;
              let new_points = old_points + amount;
              dbUser.set("points", new_points);

              let doc: Document<DBUser> | DBUser = await dbUser.save();

              await interaction.editReply({
                content: `Added ${amount.toLocaleString()} ${config.point_name(true)}${amount === 1 ? "" : "s"} to ${userMention(user.id)}\n${blockQuote(`**${config.point_name()}s** ~~${old_points.toLocaleString()}~~ -> ${doc.points.toLocaleString()} (+${(doc.points - old_points).toLocaleString()})`)}`,
              });
            }

            break;
          }

          case "remove": {
            let user = interaction.options.getUser("user", true);
            let amount = interaction.options.getNumber("amount", true);

            let dbUser = await userModel.findOne({ id: user.id });

            if (!dbUser) {
              await interaction.editReply({
                content: `Can not remove ${config.point_name(true)}s from ${userMention(user.id)} because they have 0 ${config.point_name(true)}s.`,
              });
            } else {
              let old_points = dbUser.points;
              let new_points = old_points - amount;

              if (new_points < 0)
                return await interaction.editReply({
                  content: `Can not go below 0 ${config.point_name(true)}s (${new_points})`,
                });

              dbUser.set("points", new_points);

              let doc: Document<DBUser> | DBUser = await dbUser.save();

              await interaction.editReply({
                content: `Removed ${amount.toLocaleString()} ${config.point_name(true)}${amount === 1 ? "" : "s"} from ${userMention(user.id)}\n${blockQuote(`**${config.point_name()}s** ~~${old_points.toLocaleString()}~~ -> ${doc.points.toLocaleString()} (-${(old_points - doc.points).toLocaleString()})`)}`,
              });
            }

            break;
          }

          case "set": {
            let user = interaction.options.getUser("user", true);
            let amount = interaction.options.getNumber("amount", true);

            let dbUser = await userModel.findOne({ id: user.id });

            if (!dbUser) {
              let old_points = 0;
              let new_points = amount;

              let newDbUser = new userModel({
                id: user.id,
                xp: 0,
                points: new_points,
                shownWelcomeMessage: true,
                favorite_movies: [],
                level: 0,
              });

              let doc: Document<DBUser> | DBUser = await newDbUser.save();

              await interaction.editReply({
                content: `Set ${userMention(user.id)}'s ${config.point_name(true)} balance to ${amount.toLocaleString()}\n${blockQuote(`**${config.point_name()}s** ~~${old_points.toLocaleString()}~~ -> ${doc.points.toLocaleString()}`)}`,
              });
            } else {
              let old_points = dbUser.points;
              let new_points = amount;
              dbUser.set("points", new_points);

              let doc: Document<DBUser> | DBUser = await dbUser.save();

              await interaction.editReply({
                content: `Set ${userMention(user.id)}'s ${config.point_name(true)} balance to ${amount.toLocaleString()}\n${blockQuote(`**${config.point_name()}s** ~~${old_points.toLocaleString()}~~ -> ${doc.points.toLocaleString()}`)}`,
              });
            }

            break;
          }
        }

        break;
      }
    }
  },
};

export default AdminCommand;
