import {
  ActionRowBuilder,
  ActivitiesOptions,
  ActivityType,
  ApplicationCommandData,
  Attachment,
  AttachmentBuilder,
  AutoModerationActionExecution,
  AutoModerationActionType,
  AutoModerationRule,
  AutoModerationRuleTriggerType,
  ButtonBuilder,
  ButtonStyle,
  Channel,
  channelMention,
  ChatInputCommandInteraction,
  Client,
  codeBlock,
  Colors,
  EmbedBuilder,
  Events,
  Guild,
  GuildBan,
  GuildBasedChannel,
  GuildChannel,
  GuildMember,
  GuildTextBasedChannel,
  IntentsBitField,
  InteractionCallback,
  Invite,
  Message,
  MessageFlags,
  Partials,
  Poll,
  PollData,
  PollLayoutType,
  Role,
  SeparatorSpacingSize,
  TextBasedChannel,
  TextChannel,
  ThreadAutoArchiveDuration,
  User,
  userMention,
  VoiceChannel,
} from "discord.js";
import "dotenv/config";
import { readdir, rename } from "fs";
import {
  ensureFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  readJSONSync,
  renameSync,
  writeFileSync,
  writeJSONSync,
} from "fs-extra";
import { join } from "path";
import { Command } from "./classes/Command";
import { TMComponentBuilder } from "./classes/ComponentBuilder";
import { getAverageColor } from "fast-average-color-node";
import config from "./config";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import {
  ApiClient,
  HelixCustomRewardRedemption,
  HelixStream,
} from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";
import { post } from "axios";
import mongoose from "mongoose";
import { calculateRequiredXP, removeXP } from "./utils/xpUtils";
import { DBUser, userModel } from "./models/user";
import {
  CustomCommand,
  twitchCustomCommandModel,
} from "./models/twitchCustomCommand";
import { pollModel, PollOption, PollOptions } from "./models/polls";
import os from "os";
import diff_match_patch from "diff-match-patch";
import { createPatch } from "diff";
import { TemporaryFile } from "./classes/TemporaryFile";
import {
  createAudioPlayer,
  generateDependencyReport,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { DBRaffleParticipant, raffleModel } from "./models/raffle";
import { appEmoji } from "./utils/emojiUtils";
import { execSync } from "child_process";
import {
  expireDailyQuestion,
  getAllVoters,
  getDailyQuestion,
  getDbGuild,
} from "./db/guilds";
import { initDailyEvents, modes, QuestionModes } from "./commands/daily";
import { answers, questions, reminders, voters } from "./db/schema";
import { createCustomId, parseCustomId } from "./utils/customIdUtils";
import { randomUUID } from "crypto";
import {
  getAllDmUsers,
  getAllGuildReminders,
  nextReminderTimestamp,
} from "./utils/reminderUtils";
import Lounge from "./classes/Lounge";

// throw new Error(generateDependencyReport());

export const client: Client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.AutoModerationConfiguration,
    IntentsBitField.Flags.AutoModerationExecution,
    IntentsBitField.Flags.GuildWebhooks,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.GuildScheduledEvent,
    Partials.User,
    Partials.Reaction,
  ],
});

export const player = createAudioPlayer({
  debug: true,
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause,
  },
});

export let incompatibleInvites: Map<string, Invite> = new Map();
export const globalCommandMap: Map<string, Command> = new Map();

let thirtyWarnings: Map<string, boolean> = new Map();
let fifteenWarnings: Map<string, boolean> = new Map();
let sevenWarnings: Map<string, boolean> = new Map();

export const dev_mode = process.argv.includes("-dev");
// export const dev_mode = os.hostname() !== "duckyserver";
console.log("IS DEV MODE");
// export const dev_mode = false;
// export const desiredExt = ".ts"
export const desiredExt = dev_mode ? ".ts" : ".js";

export const authProvider = new StaticAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_ACCESS_TOKEN,
);
export const twitchApiClient = new ApiClient({ authProvider });
export const twitchWs = new EventSubWsListener({ apiClient: twitchApiClient });

export const lounge = new Lounge();

export const TWITCH_CHATBOT_API_BASE = `${process.env.CHATBOT_BASE_URL}/api`;

let filteredCmds: ApplicationCommandData[] = [];
let customCmdHash: string;

// twitchWs.onChannelChatMessage()

twitchWs.onUserSocketConnect((userId) => {
  console.log(userId);
});

twitchWs.onSubscriptionCreateSuccess((subscription, apiSubscription) => {
  console.log(`Subscribed to event ${subscription.id}`);
});

export const reply = async (
  interaction: ChatInputCommandInteraction,
  container: TMComponentBuilder,
  ephemeral: boolean = false,
): Promise<InteractionCallback> => {
  let r;
  if (ephemeral)
    r = await interaction.reply({
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      components: [container.buildContainer()],
      withResponse: true,
    });
  if (!ephemeral)
    r = await interaction.reply({
      flags: [MessageFlags.IsComponentsV2],
      components: [container.buildContainer()],
      withResponse: true,
    });

  return r;
};

const degradeMs = 2592000 * 1000;
const premiumDegradeMs = degradeMs / 2;
const degradeCheckInterval = degradeMs / 2;
async function degredation(c: Client) {
  const uploadThreshold = new Date(Date.now() - degradeMs);
  const premiumUploadThreshold = new Date(Date.now() - premiumDegradeMs);
  const dbUsers = await userModel.find({ level: { $gt: 0 } });
  dbUsers.forEach(async (u: DBUser) => {
    if (u.lastMessageTimestamp !== null) {
      console.log(u.lastMessageTimestamp + " / " + uploadThreshold.getTime());
      let member = c.guilds.cache.get(config.guild).members.cache.get(u.id);

      if (
        u.level >= 6 &&
        u.lastMessageTimestamp < premiumUploadThreshold.getTime()
      ) {
        console.log(`Degrading user ${u.id} [Premium]`);
        removeXP(member, 200);
        return;
      }

      if (
        u.level >= 1 &&
        u.level <= 5 &&
        u.lastMessageTimestamp < uploadThreshold.getTime()
      ) {
        console.log(`Degrading user ${u.id}`);
        removeXP(member, 200);
      } else {
        console.log(`Not degrading user ${u.id}`);
      }
    }
  });
}

function setHash(hash: string): void {
  return writeFileSync(join(__dirname, "twitchCommandHash.txt"), hash, {
    encoding: "utf8",
  });
}

function readHash(): string {
  if (!existsSync(join(__dirname, "twitchCommandHash.txt"))) return null;
  let str = readFileSync(join(__dirname, "twitchCommandHash.txt"), {
    encoding: "utf8",
  });
  console.log("READING HASH", str);
  return str;
}

function makeHash(cmdlist: ApplicationCommandData[]): string {
  let hash = btoa(
    cmdlist.map((i: ApplicationCommandData) => `${i.name}`).join(":"),
  );
  return hash;
}

export const avg = async (
  url: string,
  hash: boolean = false,
): Promise<number | string> => {
  const ac = await getAverageColor(url);
  const str = ac.hex;
  console.log(str);
  if (hash) return str as string;
  const noHash = str.split("#")[1];
  console.log(noHash);
  try {
    return parseInt(`0x${noHash}`) as number;
  } catch (e) {
    return config.brand_color;
  }
};

async function checkFlaggedUsers() {
  let users = await userModel.find({
    deletion_flag: { $ne: null, $lt: Date.now() },
  });
  if (!users || users.length <= 0) {
    // console.log("Skipping data deletion, no valid users found.");
    return;
  } else {
    console.log(`Found ${users.length} users pending data deletion`);
    users.forEach(async (user) => {
      await userModel.findOneAndDelete({ id: user.id });
      console.log(
        `Deleted data for user id ${user.id} [XP ${user.xp} | LEVEL ${user.level}]`,
      );
    });
  }
}

async function loadEvents(c: Client) {
  const files = readdirSync(join(__dirname, "events"));
  files
    .filter((f) => f.endsWith(desiredExt))
    .forEach((file) => {
      const event = require(join(__dirname, "events", file)).default;
      const eventName = file.split(desiredExt)[0];
      console.log(eventName, event);
      if (!event)
        return console.log(
          `Didn't load event file ${file} because it's not formatted correctly.`,
        );
      if (!event.enabled)
        return console.log(
          `Didn't load event file ${file} because it's disabled`,
        );
      if (!event.run)
        return console.log(
          `Didn't load event file ${file} because it has no run method`,
        );

      c.on(eventName, (...args) => event.run(...args));
      console.log(`Loaded event ${eventName}`);
    });
}

async function loadCommands(c: Client) {
  const filesPath = join(
    process.cwd(),
    `${dev_mode ? "src" : "dist/src"}`,
    "commands",
  );
  console.log(`Checking commands dir: ${filesPath}`);
  const files = readdirSync(filesPath);
  let cmds: ApplicationCommandData[] = [];
  files
    .filter((f) => f.endsWith(desiredExt))
    .forEach((file) => {
      const cmd: Command = require(join(filesPath, file)).default;
      const cmdName = cmd.name;
      if (!cmd)
        return console.log(
          `Didn't load command file ${file} because it's not formatted correctly.`,
        );
      if (!cmd.enabled)
        return console.log(
          `Didn't load command file ${file} because it's disabled`,
        );
      if (!cmd.run)
        return console.log(
          `Didn't load command file ${file} because it has no run method`,
        );

      const cmdData = (({ enabled, run, helpDescription, category, ...o }) =>
        o)(cmd);
      cmds.push(cmdData);
      globalCommandMap.set(cmd.name, cmd);
      console.log(`Loading command ${cmd.name}`);
    });

  let twitchCommands = await twitchCustomCommandModel.find();
  // twitchCommands = twitchCommands.filter(tc => !cmds.map((o) => o.name).includes(tc.trigger.replace("!", "").toLowerCase()));
  // let filteredCmds: ApplicationCommandData[] = []
  twitchCommands = [];

  if (!twitchCommands || twitchCommands.length <= 0) {
    c.application.commands
      .set(cmds)
      .then(() => {
        console.log(`Successfully loaded ${cmds.length} commands`);
      })
      .catch((e) => {
        console.log(`Failed to load commands`);
      });
  } else {
    filteredCmds = twitchCommands.map((tc) => ({
      name: tc.trigger.replace("!", "").toLowerCase(),
      description: `Custom Command from Twitch [${tc.trigger}]`,
    })) as ApplicationCommandData[];

    console.log(
      `Loading ${filteredCmds.length} custom commands from Twitch\n${filteredCmds.map((fc) => fc.name).join(", ")}`,
    );

    cmds = [...cmds, ...filteredCmds];

    customCmdHash = makeHash(filteredCmds);
    setHash(customCmdHash);
    console.log("set hash", customCmdHash);

    c.application.commands
      .set(cmds)
      .then(() => {
        console.log(
          `Successfully loaded ${cmds.length} commands (${filteredCmds.length}/${cmds.length} from Twitch)`,
        );
      })
      .catch((e) => {
        console.log(`Failed to load commands`);
      });
  }
}

async function initBot(c: Client) {
  rename(
    join(
      __dirname,
      "commands",
      `${config.legacy_point_name.replaceAll(" ", "_")}s${desiredExt}`,
    ),
    join(
      __dirname,
      "commands",
      `${config.point_name(true, false)}s${desiredExt}`,
    ),
    async () => {
      TemporaryFile.init();
      // create spam notif prev file
      setInterval(async () => {
        await degredation(c);
      }, degradeCheckInterval);
      setInterval(async () => {
        await checkFlaggedUsers();

        // Expire Daily Questions
        let dbQuestion = getDailyQuestion(config.guild);
        if (dbQuestion && dbQuestion.question.active) {
          if (Date.now() >= dbQuestion.question.expires_at) {
            expireDailyQuestion(dbQuestion.question.guild_id);
            c.emit(
              "expireDailyQuestion",
              dbQuestion.question,
              dbQuestion.answers,
              dbQuestion.question.mode,
              dbQuestion.question.guild_id,
            );
          }
        }

        // Send reminders
        const allReminders = getAllGuildReminders(config.guild).filter(
          (r) => Date.now() >= r.next_send_timestamp,
        );

        for (const reminder of allReminders) {
          const dmUsers = getAllDmUsers(reminder.id, true);

          for (const dmUser of dmUsers) {
            let user = await client.users.fetch(dmUser.user_id);
            reminder.next_send_timestamp = nextReminderTimestamp(reminder);
            client.emit("reminderDmNotification", user, reminder);
          }
        }
      }, 1e3);
      await loadEvents(c);
      await loadCommands(c);
    },
  );

  let honeypotChannel = client.guilds.cache
    .get(config.guild)
    .channels.cache.get(config.channels.honeypot) as TextChannel;
  let honeypotMessages = await honeypotChannel.messages.fetch();
  if (!honeypotMessages.find((m) => m.author.id === client.user.id)) {
    let honeypotContainer = new TMComponentBuilder();
    honeypotContainer.setAccentColor(0xf8b929);
    honeypotContainer.addTextDisplay(
      `## 🍯 Do not send messages in this channel\nThis channel is a honeypot designed to catch scammers and spam bots.\n\nIf you send a message here, it will result in a temporary timeout for your account, and you may be considered a bot and banned.`,
    );

    honeypotChannel.send({
      flags: [MessageFlags.IsComponentsV2],
      components: [honeypotContainer.buildContainer()],
    });
  }
  // if (filteredCmds.length > 0) {
  // console.log(`Starting Twitch cmd check interval`)
  // await setInterval(async () => {
  //     const cmds = (await c.application.commands.fetch()).map(o => (o));
  //     const customCmds = (await twitchCustomCommandModel.find()).filter(tc => !cmds.filter((o) => !o.description.startsWith("Custom")).map((o) => o.name).includes(tc.trigger.replace("!", "").toLowerCase()));
  //     console.log("CUSTOM", customCmds)

  //     let fc = customCmds.map(tc => ({ name: tc.trigger.replace("!", "").toLowerCase(), description: `Custom Command from Twitch [${tc.trigger}]`, })) as ApplicationCommandData[];
  //     console.log("FC", fc)

  //     let newHash = makeHash(fc);
  //     if (fc.length <= 0) { newHash = "0"; setHash("0"); }
  //     console.log("NEW", newHash)
  //     let currentHash = readHash();
  //     console.log("new/old")
  //     console.log(`${newHash}/${currentHash}`)
  //     if (newHash === currentHash) return console.log(`Not reloading commands`);

  //     await loadCommands(c);
  //     console.log(`Twitch hash differs, sending new commands`)
  //     const labs = c.guilds.cache.get(config.guild).channels.cache.get(config.channels.labs) as TextChannel;
  //     labs.send("## Resyncing Twitch Commands\nCommands may take a moment to reload. Refresh your client if you experience issues.")

  // }, 300e3)

  let activities: ActivitiesOptions[] = [
    { name: "Watching coduh's stream", type: ActivityType.Custom },
    { name: "calculating coduh's stream time", type: ActivityType.Custom },
    { name: "bringing my own botox", type: ActivityType.Custom },
  ];

  let random = Math.floor(Math.random() * activities.length);

  let act = activities[random];
  if (!act) act = activities[0];

  c.user.setPresence({ activities: [act] });

  setInterval(() => {
    let random = Math.floor(Math.random() * activities.length);

    let act = activities[random];
    if (!act) act = activities[0];

    c.user.setPresence({ activities: [act] });
  }, 60e3);
  // }
  const user = await twitchApiClient.users.getUserByName(
    process.env.TWITCH_CHANNEL_NAME,
  );

  twitchWs.onStreamOnline(user.id, async (e) => {
    console.log(`Channel went live - ${e.broadcasterName}`);
    let apiStream = await twitchApiClient.streams.getStreamByUserId(
      e.broadcasterId,
    );
    console.log("STREAM", apiStream.gameName, apiStream.startDate);
    try {
      const notifChannel = c.guilds.cache
        .get(config.guild)
        .channels.cache.get(config.channels.streams) as TextChannel;
      let existingNotificationId: string = existsSync(
        join(__dirname, "streamNotificationId.txt"),
      )
        ? readFileSync(join(__dirname, "streamNotificationId.txt"), {
            encoding: "utf8",
          })
        : null;
      let existingNotificationMessage = existingNotificationId
        ? await notifChannel.messages.fetch(existingNotificationId)
        : null;
      let editMessage: Message<boolean> | null = null;
      // if (existingNotificationMessage && !existingNotificationMessage.partial && existingNotificationMessage.editable) {
      //     editMessage = existingNotificationMessage
      // }
      let latestTimestamp: number = Date.now();
      writeFileSync(
        join(__dirname, "streamTimestamp.txt"),
        latestTimestamp.toString(),
        { encoding: "utf8" },
      );

      let stream = apiStream;
      if (!stream || !stream?.startDate || !stream?.gameName || !stream?.title)
        stream = null;

      const liveCon = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      liveCon.addTextDisplay(
        `-# <@&${config.roles.members}>\n# [${(await stream.getUser()).displayName ?? process.env.TWITCH_CHANNEL_NAME} is Live!](https://twitch.tv/${process.env.TWITCH_CHANNEL_NAME})`,
      );
      if (stream && stream?.startDate && stream?.gameName && stream?.title)
        liveCon.addTextDisplay(
          `> ${stream?.title}${stream?.gameName !== "" ? `\n-# Playing **${stream?.gameName}**` : ``}`,
        );
      liveCon.addSeparator(SeparatorSpacingSize.Large, false);
      if (stream && stream.getThumbnailUrl)
        liveCon.addMediaGallery([
          { media: { url: stream?.getThumbnailUrl(1920, 1080) } },
        ]);

      if (editMessage !== null) {
        editMessage
          .edit({ components: [liveCon.buildContainer()] })
          .then((m) => {
            writeFileSync(join(__dirname, "streamNotificationId.txt"), m.id, {
              encoding: "utf8",
            });
          });
      } else {
        notifChannel
          .send({
            flags: [MessageFlags.IsComponentsV2],
            components: [liveCon.buildContainer()],
          })
          .then((m) => {
            writeFileSync(join(__dirname, "streamNotificationId.txt"), m.id, {
              encoding: "utf8",
            });
          });
      }

      // ensureFileSync(join(__dirname, "streamData.json"))

      // if(stream) {writeJSONSync(join(__dirname, "streamData.json"), { startDate: stream?.startDate ? stream.startDate.getTime() : latestTimestamp, gameName: stream?.gameName || "a mystery game" }, { encoding: "utf8" });} else {
      //     writeJSONSync(join(__dirname, "streamData.json"), { startDate: latestTimestamp, gameName: "a mystery game" }, { encoding: "utf8" });
      // }
    } catch (e) {
      console.log(e);
    }
  });

  twitchWs.onStreamOffline(user.id, async (e) => {
    console.log(`Channel went offline - ${e.broadcasterId}`);
    try {
      const notifChannel = c.guilds.cache
        .get(config.guild)
        .channels.cache.get(config.channels.streams) as TextChannel;
      let existingNotificationId: string = existsSync(
        join(__dirname, "streamNotificationId.txt"),
      )
        ? readFileSync(join(__dirname, "streamNotificationId.txt"), {
            encoding: "utf8",
          })
        : null;
      let existingNotificationMessage = existingNotificationId
        ? await notifChannel.messages.fetch(existingNotificationId)
        : null;
      let editMessage: Message<boolean> | null = null;
      if (
        existingNotificationMessage &&
        !existingNotificationMessage.partial &&
        existingNotificationMessage.editable
      ) {
        editMessage = existingNotificationMessage;
      }

      const stream: any = {
        startDate: existsSync(join(__dirname, "streamTimestamp.txt"))
          ? readFileSync(join(__dirname, "streamTimestamp.txt"), {
              encoding: "utf8",
            })
          : null,
        gameName: "",
      };

      if (!stream) return;

      let channelUser = await twitchApiClient.users.getUserByName(
        process.env.TWITCH_CHANNEL_NAME,
      );
      if (!channelUser) return;

      setTimeout(async () => {
        let vods = await twitchApiClient.videos.getVideosByUser(
          channelUser.id,
          { period: "day", orderBy: "time", type: "archive" },
        );

        let lastVod = vods.data[0];
        if (lastVod && lastVod.userId) {
          let apiChannel = await twitchApiClient.channels.getChannelInfoById(
            lastVod.userId,
          );
          if (apiChannel) {
            if (!stream.gameName || stream.gameName === "")
              stream.gameName = apiChannel.gameName;
          }
        }

        let offlineCon = new TMComponentBuilder().setAccentColor(
          config.brand_color,
        );
        offlineCon.addTextDisplay(
          `### ${channelUser.displayName} was Live${stream.startDate && !Number.isNaN(stream.startDate) ? ` on <t:${Math.floor(stream.startDate / 1000)}:f> (<t:${Math.floor(stream.startDate / 1000)}:R>)` : "!"}\n> ${stream.gameName !== "" ? `Played ${stream?.gameName || "a mystery game"} until <t:${Math.floor(Date.now() / 1000)}:f>` : `Streamed from <t:${Math.floor(stream.startDate / 1000)}:t> to <t:${Math.floor(Date.now() / 1000)}:t>`}${lastVod ? `\n### [Click to Watch VOD](https://twitch.tv/videos/${lastVod.id})` : ""}`,
        );
        offlineCon.addSeparator(SeparatorSpacingSize.Large, false);

        if (editMessage !== null) {
          editMessage
            .edit({ components: [offlineCon.buildContainer()] })
            .then((m) => {
              writeFileSync(join(__dirname, "streamNotificationId.txt"), "", {
                encoding: "utf8",
              });
              // writeJSONSync(join(__dirname, "streamData.json"), {}, { encoding: "utf8" });
            });
        } else {
          writeFileSync(join(__dirname, "streamNotificationId.txt"), "", {
            encoding: "utf8",
          });
          // writeJSONSync(join(__dirname, "streamData.json"), {}, { encoding: "utf8" });
        }
      }, 30e3);
    } catch (e) {
      console.log(e);
    }
  });

  twitchWs.onChannelPollBegin(user.id, (e) => {
    if (
      !e.isBitsVotingEnabled &&
      !e.isChannelPointsVotingEnabled &&
      config.polls_enabled
    ) {
      const hangout: TextChannel = c.guilds.cache
        .get(config.guild)
        .channels.cache.get(config.channels.hangout) as TextChannel;
      const poll: PollData = {
        allowMultiselect: false,
        layoutType: PollLayoutType.Default,
        duration: 1,
        question: { text: e.title },
        answers: e.choices.map((choice) => ({ text: choice.title })),
      };
      let choices: PollOptions = {};
      e.choices.forEach((choice) => {
        choices[choice.id] = { id: choice.id, text: choice.title, votes: 0 };
      });

      hangout
        .send({
          poll,
          content: `**New Twitch Poll** \`${e.title}\` (voting ends <t:${Math.floor(e.endDate.getTime() / 1000)}:R>)`,
        })
        .then(async (m) => {
          const newDbPoll = new pollModel({
            id: e.id,
            messageId: m.id,
            options: choices,
            title: e.title,
          });

          await newDbPoll.save();
          await post(
            `${TWITCH_CHATBOT_API_BASE}/polls/start/${encodeURI(newDbPoll.id)}`,
          );
        })
        .catch((e) => {
          console.log(e);
          console.log("Failed to transfer poll to Discord");
        });
    }
  });

  twitchWs.onChannelPollEnd(user.id, async (e) => {
    if (
      !e.isBitsVotingEnabled &&
      !e.isChannelPointsVotingEnabled &&
      config.polls_enabled
    ) {
      const hangout: TextChannel = c.guilds.cache
        .get(config.guild)
        .channels.cache.get(config.channels.hangout) as TextChannel;
      const dbPoll = await pollModel.findOne({ id: e.id });
      if (!dbPoll) return;

      await hangout.messages.fetch();
      const pollMessage = hangout.messages.cache.get(dbPoll.messageId);
      // if(!pollMessage || !pollMessage.deletable) {
      //     await pollModel.deleteOne({id: dbPoll.id});
      //     return;
      // }

      let choices: { id: string; text: string; votes: number }[] = [];

      e.choices.forEach((choice) => {
        choices.push({
          id: choice.id,
          text: choice.title,
          votes: choice.totalVotes,
        });
      });

      const poll: Poll = pollMessage.poll;
      poll.answers.forEach((a) => {
        let ch =
          choices[choices.indexOf(choices.find((ch) => ch.text === a.text))];
        choices[choices.indexOf(choices.find((ch) => ch.text === a.text))] = {
          id: ch.id,
          text: ch.text,
          votes: ch.votes + a.voteCount,
        };
        choices = choices;
      });

      console.log(choices);
      let options: PollOptions = {};
      choices.forEach((choice) => {
        options[choice.id] = {
          id: choice.id,
          text: choice.text,
          votes: choice.votes,
        };
      });

      await pollModel.findOneAndUpdate({ id: dbPoll.id }, { options });
      if (pollMessage.deletable) await pollMessage.delete();

      const con = new TMComponentBuilder().setAccentColor(config.brand_color);
      con.addTextDisplay(
        `-# Poll Ended\n## **${dbPoll.title}**\n${choices
          .sort((a, b) => b.votes - a.votes)
          .map(
            (ch, i) =>
              `### ${i === 0 ? `👑 ` : ``}${i + 1}. ${ch.text} (${ch.votes} vote${ch.votes === 1 ? "" : "s"})`,
          )
          .join("\n")}`,
      );

      await hangout.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [con.buildContainer()],
      });
      await post(
        `${TWITCH_CHATBOT_API_BASE}/polls/end/${encodeURI(dbPoll.id)}`,
      );
    }
  });

  setInterval(async () => {
    // Raffle Interval
    let raffle = (await raffleModel.find())?.[0] || null;
    if (raffle) {
      let channel = client.guilds.cache
        .get(config.guild)
        .channels.cache.get(raffle.channel_id) as TextChannel;

      let thirtySeconds = Date.now() + 30e3;
      let fifteenSeconds = Date.now() + 15e3;
      let sevenSeconds = Date.now() + 7e3;

      let raffleExpiration = raffle.expires_at;

      // console.log("30",`${raffleExpiration}/${thirtySeconds}`, raffleExpiration <= thirtySeconds)
      // console.log("15",`${raffleExpiration}/${fifteenSeconds}`, raffleExpiration <= fifteenSeconds)
      // console.log("7",`${raffleExpiration}/${sevenSeconds}`, raffleExpiration <= sevenSeconds)

      if (raffleExpiration <= Date.now()) {
        thirtyWarnings.set(raffle.id, true);
        fifteenWarnings.set(raffle.id, true);
        sevenWarnings.set(raffle.id, true);

        let participants = raffle.participants;
        let channel = client.guilds.cache
          .get(config.guild)
          .channels.cache.get(raffle.channel_id) as TextChannel;
        if (!raffle.winner_id) {
          if (participants && participants.length > 0) {
            let randomInd = Math.floor(Math.random() * participants.length);
            let winnerId = participants[randomInd].id || participants[0].id;
            let winner = await client.users.fetch(winnerId);
            if (winner) {
              let dbUser = await userModel.findOne({ id: winner.id });
              if (!dbUser) {
                let newUser = new userModel({
                  twitchId: winner.id,
                  points: raffle.points,
                  xp: 0,
                  level: 0,
                  shownWelcomeMessage: true,
                });

                await newUser.save();
              } else {
                dbUser.set("points", dbUser.points + raffle.points);
                await dbUser.save();
              }
              await raffleModel.findOneAndDelete({ id: raffle.id });
              await dbUser.set("points", dbUser.points + raffle.points);
              await dbUser.save();
              channel.send({
                content: `## ${await appEmoji(client, "yay")} ${userMention(winner.id)} won the raffle for **${raffle.points.toLocaleString()} ${config.point_name(false)}${raffle.points === 1 ? "" : "s"}**! ${await appEmoji(client, "stripj")}`,
              });
              let logChannel = client.guilds.cache
                .get(config.guild)
                .channels.cache.get(config.channels.logs) as TextChannel;

              logChannel.send({
                flags: [MessageFlags.IsComponentsV2],
                components: [
                  logContainer(
                    "Raffle Won",
                    `${userMention(winner.id)} (${winner.id}) won a raffle created by ${userMention(raffle.creator_id)} (${raffle.creator_id}) for ${raffle.points.toLocaleString()} ${config.point_name(true)}${raffle.points === 1 ? "" : "s"}\n### Participants (${raffle.participants.length.toLocaleString()})\n${raffle.participants.map((p: DBRaffleParticipant) => `- ${userMention(p.id)}`).join("\n")}`,
                  ).buildContainer(),
                ],
              });
            } else {
              channel.send({
                content: `## ${await appEmoji(client, "noooo")} The raffle winner had a heart attack and fucking died`,
              });
              await raffleModel.findOneAndDelete({ id: raffle.id });
            }
          } else {
            channel.send({
              content: `## ${await appEmoji(client, "smokee")} Nobody entered the raffle`,
            });
            await raffleModel.findOneAndDelete({ id: raffle.id });
          }
        } else await raffleModel.findOneAndDelete({ id: raffle.id });
      }

      if (raffleExpiration <= thirtySeconds && !thirtyWarnings.has(raffle.id)) {
        thirtyWarnings.set(raffle.id, true);
        // await reply(client, null, `The raffle expires in 30 seconds`)
        channel.send({
          content: `${await appEmoji(client, "pausej")} The raffle for ${raffle.points.toLocaleString()} ${config.point_name(true)}${raffle.points === 1 ? "" : "s"} expires <t:${Math.floor(raffle.expires_at / 1000)}:R>!`,
        });
      }

      if (
        raffleExpiration <= fifteenSeconds &&
        !fifteenWarnings.has(raffle.id)
      ) {
        thirtyWarnings.set(raffle.id, true);
        fifteenWarnings.set(raffle.id, true);
        channel.send({
          content: `${await appEmoji(client, "pausej")} The raffle for ${raffle.points.toLocaleString()} ${config.point_name(true)}${raffle.points === 1 ? "" : "s"} expires <t:${Math.floor(raffle.expires_at / 1000)}:R>!`,
        });
      }

      if (raffleExpiration <= sevenSeconds && !sevenWarnings.has(raffle.id)) {
        thirtyWarnings.set(raffle.id, true);
        fifteenWarnings.set(raffle.id, true);
        sevenWarnings.set(raffle.id, true);
        channel.send({
          content: `${await appEmoji(client, "pausej")} The raffle for ${raffle.points.toLocaleString()} ${config.point_name(true)}${raffle.points === 1 ? "" : "s"} expires <t:${Math.floor(raffle.expires_at / 1000)}:R>!`,
        });
      }
    }
  }, 2e3);
}

client.on(Events.ClientReady, async (c) => {
  await initBot(c);
  const labs = c.guilds.cache
    .get(config.guild)
    .channels.cache.get(config.channels.labs) as TextChannel;
  const startCon = new TMComponentBuilder().setAccentColor(config.brand_color);
  await c.application.commands.fetch();
  startCon.addTextDisplay(
    `-# <t:${Math.floor(Date.now() / 1000)}:F>\n## Bot is Starting...\n> \`Env\` | ${dev_mode ? "DEVELOPMENT" : "PRODUCTION"}\n> \`Hostname\` | ${os.hostname()}\n> \`Twitch User\` | ${process.env.TWITCH_CHANNEL_NAME}\n> \`Polls Integration?\` | ${config.polls_enabled ? "Yes" : "No"}\n> \`Commands\` ${c.application.commands.cache.size}\n${c.application.commands.cache.map((cc) => `${cc.name}`).join(", ")}`,
  );
  labs.send({
    components: [startCon.buildContainer()],
    flags: [MessageFlags.IsComponentsV2],
  });
  let osname =
    os.platform().toLowerCase() !== "win32"
      ? (await execSync(
          `cat /etc/os-release | grep "^NAME=\".*\"" | sed 's/NAME="//' | sed 's/"//'`,
        ).toString()) || os.release()
      : os.release();
  console.log(
    `[${os.userInfo({ encoding: "utf8" }).username}@${os.hostname()} ${dev_mode ? "DEVELOPMENT" : "PRODUCTION"}] Client logged in as ${c.user.username} on ${osname}`,
  );
});

export function logContainer(
  heading: string,
  content: string,
  level: "DEFAULT" | "SUCCESS" | "DANGER" = "DEFAULT",
): TMComponentBuilder {
  const con = new TMComponentBuilder();
  if (level === "DANGER") con.setAccentColor(Colors.Red);
  if (level === "SUCCESS") con.setAccentColor(Colors.Green);
  if (level === "DEFAULT") con.setAccentColor(Colors.Grey);
  con.addTextDisplay(`## ${heading}\n${content}`);
  con.addSeparator();
  con.addTextDisplay(`-# **Happened:** <t:${Math.floor(Date.now() / 1000)}:R>`);
  return con;
}

export async function logEvent(
  event: Events | string,
  args: { [key: string]: any },
) {
  console.log(`Received event ${event}`);
  const logChannel = client.guilds.cache
    .get(config.guild)
    .channels.cache.get(config.channels.logs) as TextChannel;
  switch (event) {
    case Events.ChannelCreate: {
      let channel: Channel = args["channel"];
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(`Channel Created`, `<#${channel.id}>`).buildContainer(),
        ],
      });
      break;
    }
    case Events.ChannelDelete: {
      let channel: GuildChannel = args["channel"];
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Channel Deleted`,
            `#${channel.name}`,
            "DANGER",
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.GuildMemberRemove: {
      let member: GuildMember = args["member"];
      if (member.guild.id !== config.guild) return;
      if (args["flag"]) {
        logChannel.send({
          flags: [MessageFlags.IsComponentsV2],
          components: [
            logContainer(
              `Member Left`,
              `${member.user.username} (${member.id})\n-# Their data will automatically be deleted (and all XP history lost) <t:${Math.floor(parseInt(args["flag"]) / 1000)}:R>`,
              "DANGER",
            ).buildContainer(),
          ],
        });
      } else {
        logChannel.send({
          flags: [MessageFlags.IsComponentsV2],
          components: [
            logContainer(
              `Member Left`,
              `${member.user.username} (${member.id})`,
              "DANGER",
            ).buildContainer(),
          ],
        });
      }
      break;
    }
    case Events.GuildUpdate: {
      let old_guild: Guild = args["old_guild"];
      let new_guild: Guild = args["new_guild"];

      let changes: { key: string; old_value: string; new_value: string }[] = [];

      if (old_guild.name !== new_guild.name)
        changes.push({
          key: "Name",
          new_value: new_guild.name,
          old_value: old_guild.name,
        });
      if (old_guild.premiumTier !== new_guild.premiumTier)
        changes.push({
          key: "Boost Tier",
          new_value: new_guild.premiumTier.toString(),
          old_value: old_guild.premiumTier.toString(),
        });
      if (
        old_guild.premiumSubscriptionCount !==
        new_guild.premiumSubscriptionCount
      )
        changes.push({
          key: "Boosts",
          new_value: new_guild.premiumSubscriptionCount.toLocaleString(),
          old_value: old_guild.premiumSubscriptionCount.toLocaleString(),
        });
      if (old_guild.verificationLevel !== new_guild.verificationLevel)
        changes.push({
          key: "Verification Level",
          new_value: new_guild.verificationLevel.toString(),
          old_value: old_guild.verificationLevel.toString(),
        });

      if (changes.length <= 0) return;
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Server Updated`,
            changes
              .map((c) => `**${c.key}:** ~~${c.old_value}~~ -> ${c.new_value}`)
              .join("\n"),
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.GuildRoleCreate: {
      let role: Role = args["role"];
      if (role.guild.id !== config.guild) return;
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Role Created`,
            `${role.name}`,
            "DEFAULT",
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.GuildRoleDelete: {
      let role: Role = args["role"];
      if (role.guild.id !== config.guild) return;
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Role Deleted`,
            `${role.name}`,
            "DANGER",
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.GuildRoleUpdate: {
      let old_role: Role = args["old_role"];
      let new_role: Role = args["new_role"];

      if (new_role.guild.id !== config.guild) return;

      let changes: { key: string; old_value: string; new_value: string }[] = [];
      let additions = [];
      let removals = [];

      if (old_role.name !== new_role.name)
        changes.push({
          key: "Name",
          new_value: new_role.name,
          old_value: old_role.name,
        });
      if (old_role.permissions.toArray() !== new_role.permissions.toArray()) {
        let olds = old_role.permissions.toArray();
        let news = new_role.permissions.toArray();
        olds.forEach((key) => {
          // removals
          if (!news.includes(key)) removals.push(key);
        });
        news.forEach((key) => {
          if (!olds.includes(key)) additions.push(key);
        });
      }

      if (changes.length <= 0) return;
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Role Updated (${old_role.name})`,
            `${changes.map((c) => `**${c.key}:** ~~${c.old_value}~~ -> ${c.new_value}`).join("\n")}${additions.length > 0 ? `### Permissions Added\n${additions.map((a) => `+${a}`).join("\n")}` : ``}${removals.length > 0 ? `### Permissions Removed\n${removals.map((a) => `-${a}`).join("\n")}` : ``}`,
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.AutoModerationRuleCreate: {
      let rule: AutoModerationRule = args["rule"];
      let type = "Default";
      if (rule.triggerType === AutoModerationRuleTriggerType.Keyword)
        type = "Custom Keyword Filter";
      if (rule.triggerType === AutoModerationRuleTriggerType.KeywordPreset)
        type = "Commonly Flagged Words (Preset)";
      if (rule.triggerType === AutoModerationRuleTriggerType.MemberProfile)
        type = "Block Words in Member Profiles (Preset)";
      if (rule.triggerType === AutoModerationRuleTriggerType.MentionSpam)
        type = "Block Mention (@) spam (Preset)";
      if (rule.triggerType === AutoModerationRuleTriggerType.Spam)
        type = "Block Suspected Spam Messages (Preset)";

      let statusStr: string[] = [];

      if (rule.actions.length > 0) {
        let actionDict = {
          "1": "Block Message",
          "2": "Send Alert",
          "3": "Timeout Member",
          "4": "Block Member Interaction",
        };

        let durationDict = {
          "60": "1 Minute",
          "300": "5 Minutes",
          "600": "10 Minutes",
          "3600": "1 Hour",
          "86400": "1 Day",
          "604800": "1 Week",
        };

        let actions = rule.actions;
        statusStr.push(
          `### Execution Action${actions.length === 1 ? "" : "s"} (${actions.length})`,
        );
        actions.forEach((a) => {
          if (
            a.type === AutoModerationActionType.Timeout &&
            a.metadata.durationSeconds
          ) {
            statusStr.push(
              `- \`${actionDict[a.type.toString()]} - ${durationDict[a.metadata.durationSeconds.toString()]}\``,
            );
          } else if (a.type === AutoModerationActionType.BlockMessage) {
            statusStr.push(
              `- \`${actionDict[a.type.toString()]}\`${a.metadata.customMessage ? `\n\t\t- **Custom Response:**\n> \`${a.metadata.customMessage}\`` : ""}`,
            );
          } else if (a.type === AutoModerationActionType.SendAlertMessage) {
            statusStr.push(
              `- \`${actionDict[a.type.toString()]}\`${a.metadata.channelId ? ` - ${channelMention(a.metadata.channelId)}` : ""}`,
            );
          } else if (
            a.type === AutoModerationActionType.BlockMemberInteraction
          ) {
            statusStr.push(
              `- \`${actionDict[a.type.toString()]}\`${a.metadata.channelId ? ` - ${channelMention(a.metadata.channelId)}` : ""}`,
            );
          }
        });
      }

      if (rule.triggerMetadata.keywordFilter.length > 0) {
        let blockedTerms = rule.triggerMetadata.keywordFilter;
        statusStr.push(
          `### Blocked Term${blockedTerms.length === 1 ? "" : "s"} (${blockedTerms.length})`,
        );
        if (blockedTerms.length < 5) {
          blockedTerms.forEach((a) => {
            statusStr.push(`- \`${a}\``);
          });
        } else {
          statusStr.push(blockedTerms.map((a) => `\`${a}\``).join(", "));
        }
      }

      if (rule.triggerMetadata.regexPatterns.length > 0) {
        let patterns = rule.triggerMetadata.regexPatterns;
        statusStr.push(
          `### Regex Pattern${patterns.length === 1 ? "" : "s"} (${patterns.length})`,
        );
        if (patterns.length < 5) {
          patterns.forEach((a) => {
            statusStr.push(`- \`${a}\``);
          });
        } else {
          statusStr.push(patterns.map((a) => `\`${a}\``).join(", "));
        }
      }

      if (rule.triggerMetadata.allowList.length > 0) {
        let allowedTerms = rule.triggerMetadata.allowList;
        statusStr.push(
          `### Allowed Term${allowedTerms.length === 1 ? "" : "s"} (${allowedTerms.length})`,
        );
        allowedTerms.forEach((a) => {
          statusStr.push(`- \`${a}\``);
        });
      }

      if (rule.exemptRoles.size > 0) {
        let exemptRoles = rule.exemptRoles;
        statusStr.push(
          `### Exempt Role${exemptRoles.size === 1 ? "" : "s"} (${exemptRoles.size})`,
        );
        if (exemptRoles.size < 5) {
          exemptRoles.forEach((a) => {
            statusStr.push(`- \`@${a.name}\``);
          });
        } else {
          statusStr.push(exemptRoles.map((a) => `\`@${a.name}\``).join(", "));
        }
      }

      if (rule.exemptChannels.size > 0) {
        let exemptChannels = rule.exemptChannels;
        statusStr.push(
          `### Exempt Channel${exemptChannels.size === 1 ? "" : "s"} (${exemptChannels.size})`,
        );
        if (exemptChannels.size < 5) {
          exemptChannels.forEach((a) => {
            statusStr.push(
              `- \`${a.isTextBased() ? "💬 " : a.isVoiceBased() ? "🔉 " : a.parentId === null ? "📁 " : ""}${a.name}\``,
            );
          });
        } else {
          statusStr.push(
            exemptChannels
              .map(
                (a) =>
                  `\`${a.isTextBased() ? "💬 " : a.isVoiceBased() ? "🔉 " : a.parentId === null ? "📁 " : ""}${a.name}\``,
              )
              .join(", "),
          );
        }
      }

      let container = logContainer(
        type.includes("Preset")
          ? "Default AutoMod Rule Enabled"
          : "AutoMod Rule Created",
        `-# - **Rule Name:** ${rule.name}\n-# - **Rule ID:** ${rule.id}\n-# - **Rule Type:** ${type}\n-# - **Created By:** ${userMention(rule.creatorId)} (${rule.creatorId})\n${statusStr.join("\n")}`,
        "SUCCESS",
      );

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [container.buildContainer()],
      });
    }
    case Events.AutoModerationRuleUpdate: {
      let old_rule: AutoModerationRule = args["old_rule"];
      let new_rule: AutoModerationRule = args["new_rule"];

      console.log("OLD", old_rule);
      console.log("NEW", new_rule);

      if (!old_rule) return;

      let changes: { key: string; old_value: any; new_value: any }[] = [];

      if (old_rule.name !== new_rule.name)
        changes.push({
          key: "Name",
          old_value: old_rule.name,
          new_value: new_rule.name,
        });
      if (old_rule.enabled !== new_rule.enabled)
        changes.push({
          key: "Enabled",
          old_value: old_rule.enabled ? "yes" : "no",
          new_value: new_rule.enabled ? "yes" : "no",
        });
      if (
        old_rule.triggerMetadata.keywordFilter !==
        new_rule.triggerMetadata.keywordFilter
      ) {
        let addedFilters = new_rule.triggerMetadata.keywordFilter.filter(
          (f) => !old_rule.triggerMetadata.keywordFilter.includes(f),
        );
        let removedFilters = old_rule.triggerMetadata.keywordFilter.filter(
          (f) => !new_rule.triggerMetadata.keywordFilter.includes(f),
        );

        addedFilters.forEach((f) => {
          changes.push({
            key: "✅ Keyword Added",
            old_value: "",
            new_value: `+\`${f}\``,
          });
        });

        removedFilters.forEach((f) => {
          changes.push({
            key: "❌ Keyword Removed",
            old_value: "",
            new_value: `-\`${f}\``,
          });
        });
      }

      if (old_rule.exemptChannels !== new_rule.exemptChannels) {
        let addedFilters = new_rule.exemptChannels.filter(
          (f) => !old_rule.exemptChannels.has(f.id),
        );
        let removedFilters = old_rule.exemptChannels.filter(
          (f) => !new_rule.exemptChannels.has(f.id),
        );

        addedFilters.forEach((f) => {
          changes.push({
            key: `✅ ${f.isTextBased() ? "Channel" : f.isVoiceBased() ? "Channel" : f.parentId === null ? "Category" : "Channel"} Exempted`,
            old_value: "",
            new_value: `+\`${f.isTextBased() ? "💬 " : f.isVoiceBased() ? "🔉 " : f.parentId === null ? "📁 " : ""}${f.name}\``,
          });
        });

        removedFilters.forEach((f) => {
          changes.push({
            key: `❌ ${f.isTextBased() ? "Channel" : f.isVoiceBased() ? "Channel" : f.parentId === null ? "Category" : "Channel"} Un-Exempted`,
            old_value: "",
            new_value: `-\`${f.isTextBased() ? "💬 " : f.isVoiceBased() ? "🔉 " : f.parentId === null ? "📁 " : ""}${f.name}\``,
          });
        });
      }

      if (changes.length <= 0) return;
      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `AutoMod Rule Updated (${old_rule.name})`,
            `${changes.map((c) => `- **${c.key}:** ${c.old_value !== "" ? `~~${c.old_value}~~ ->` : ""} ${c.new_value}`).join("\n")}`,
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.AutoModerationRuleDelete: {
      let rule: AutoModerationRule = args["rule"];
      let type = "Default";
      if (rule.triggerType === AutoModerationRuleTriggerType.Keyword)
        type = "Custom Keyword Filter";
      if (rule.triggerType === AutoModerationRuleTriggerType.KeywordPreset)
        type = "Commonly Flagged Words (Preset)";
      if (rule.triggerType === AutoModerationRuleTriggerType.MemberProfile)
        type = "Block Words in Member Profiles (Preset)";
      if (rule.triggerType === AutoModerationRuleTriggerType.MentionSpam)
        type = "Block Mention (@) spam (Preset)";
      if (rule.triggerType === AutoModerationRuleTriggerType.Spam)
        type = "Block Suspected Spam Messages (Preset)";

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            type.includes("Preset")
              ? "Default AutoMod Rule Disabled"
              : "AutoMod Rule Deleted",
            `-# - **Rule Name:** ${rule.name}\n-# - **Rule ID:** ${rule.id}\n-# - **Rule Type:** ${type}`,
            "DANGER",
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.AutoModerationActionExecution: {
      let execution: AutoModerationActionExecution = args["execution"];
      let actionType = execution.action.type;
      let rule = execution.autoModerationRule;

      if (actionType === AutoModerationActionType.SendAlertMessage) return;

      let actionDict = {
        "1": "Block Message",
        "2": "Send Alert",
        "3": "Timeout Member",
        "4": "Block Member Interaction",
      };

      let durationDict = {
        "60": "1 Minute",
        "300": "5 Minutes",
        "600": "10 Minutes",
        "3600": "1 Hour",
        "86400": "1 Day",
        "604800": "1 Week",
      };

      if (execution.action.metadata.durationSeconds)
        actionDict["3"] =
          `Timeout Member - ${durationDict[execution.action.metadata.durationSeconds.toString()]}`;

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `AutoMod ${actionType === AutoModerationActionType.Timeout ? `Timed Out ${execution.member.user.username}` : actionType === AutoModerationActionType.BlockMessage ? `Blocked a Message from ${execution.member.user.username}` : `Rule Executed on ${execution.member.user.username}`}`,
            `${rule ? `-# - **Rule Name:** ${rule.name}\n-# - **Rule ID:** ${rule.id}\n` : ""}-# - **Rule Type:** ${actionDict[actionType.toString()]}${execution.matchedContent ? `\n-# - **Matched Content:** \`${execution.matchedContent}\`` : execution.matchedKeyword ? `\n-# - **Matched Keyword:** \`${execution.matchedKeyword}\`` : ""}`,
            "DANGER",
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.ChannelUpdate: {
      let old_channel: GuildChannel = args["old_channel"];
      let new_channel: GuildChannel = args["new_channel"];

      let rateLimitDict = {
        "0": "None",
        "5": "5 Seconds",
        "10": "10 Seconds",
        "15": "15 Seconds",
        "30": "30 Seconds",
        "60": "1 Minute",
        "120": "2 Minutes",
        "300": "5 Minutes",
        "600": "10 Minutes",
        "900": "15 Minutes",
        "1800": "30 Minutes",
        "3600": "1 Hour",
        "7200": "2 Hours",
        "21600": "6 Hours",
      };

      rateLimitDict[`${ThreadAutoArchiveDuration.OneDay}`] = "1 Day";
      rateLimitDict[`${ThreadAutoArchiveDuration.ThreeDays}`] = "3 Days";
      rateLimitDict[`${ThreadAutoArchiveDuration.OneWeek}`] = "1 Week";

      if (!old_channel) return;

      console.log((old_channel as TextChannel).rateLimitPerUser);

      let changes: { key: string; old_value: any; new_value: any }[] = [];

      if (old_channel.name !== new_channel.name)
        changes.push({
          key: "Name",
          old_value: old_channel.name,
          new_value: new_channel.name,
        });

      if (old_channel.isTextBased() && new_channel.isTextBased()) {
        let o = old_channel as TextChannel;
        let n = new_channel as TextChannel;

        if (o.topic !== n.topic)
          changes.push({
            key: "Topic",
            old_value: `\`${o.topic || "No Topic Set"}\``,
            new_value: `\`${n.topic || "No Topic Set"}\``,
          });
        if (o.rateLimitPerUser !== n.rateLimitPerUser)
          changes.push({
            key: "Slowmode",
            old_value: `\`${rateLimitDict[o.rateLimitPerUser.toString()]}\``,
            new_value: `\`${rateLimitDict[n.rateLimitPerUser.toString()]}\``,
          });
        if (o.defaultAutoArchiveDuration !== n.defaultAutoArchiveDuration)
          changes.push({
            key: "Thread Auto-Archive",
            old_value: `\`${rateLimitDict[o.defaultAutoArchiveDuration.toString()]}\``,
            new_value: `\`${rateLimitDict[n.defaultAutoArchiveDuration.toString()]}\``,
          });
      }

      if (old_channel.isVoiceBased() && new_channel.isVoiceBased()) {
        let o = old_channel as VoiceChannel;
        let n = new_channel as VoiceChannel;

        if (o.userLimit !== n.userLimit)
          changes.push({
            key: "User Limit",
            old_value: `\`${o.userLimit || "Unlimited"}\``,
            new_value: `\`${n.userLimit || "Unlimited"}\``,
          });
      }

      if (changes.length <= 0) return;

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Channel Updated (${channelMention(old_channel.id)})`,
            `${changes.map((c) => `- **${c.key}:** ${c.old_value !== "" ? `~~${c.old_value}~~ ->` : ""} ${c.new_value}`).join("\n")}`,
          ).buildContainer(),
        ],
      });
      break;
    }
    case Events.MessageUpdate: {
      let o: Message = args["old_message"];
      let n: Message = args["new_message"];

      let oldMessage = o;
      let newMessage = n;

      if (!oldMessage.content || !newMessage.content) return;
      if (oldMessage.content == newMessage.content) return;
      if (oldMessage.author.bot) return;

      let correct = 0;
      for (let i = 0; i < oldMessage.content.length; i++) {
        if (oldMessage.content.charAt(i) == newMessage.content.charAt(i)) {
          correct += 1;
        }
      }

      const difference = correct / oldMessage.content.length;

      let humanPatch = "";
      const patch = createPatch(
        o.url,
        oldMessage.content + "\n",
        newMessage.content + "\n",
      );

      const dmp = new diff_match_patch();
      const diff = dmp.diff_main(oldMessage.content, newMessage.content);
      dmp.diff_cleanupSemantic(diff);

      let previous = 0;

      for (let index = 0; index < diff.length; index++) {
        const change = diff[index];

        if (change[0] != previous) {
          if (previous == -1) humanPatch += "~~‎";
          if (previous == 1) humanPatch += "__‎";
        }

        switch (change[0]) {
          case -1:
            humanPatch += "~~";
            break;

          case 1:
            humanPatch += "__";
            break;

          default:
            break;
        }

        humanPatch += change[1];
        previous = change[0];
      }
      if (previous == -1) humanPatch += "~~‎";
      if (previous == 1) humanPatch += "__‎";

      if (humanPatch === "") return;

      logChannel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `${o.member.user.username} (${
                  o.member.id
                }) edited their message in ${
                  (o.channel as GuildBasedChannel).name
                }`,
              )
              .setURL(o.url)
              .setDescription(humanPatch)
              .setFooter({ text: "Happened" })
              .setTimestamp(),
          ],
          files: [
            new AttachmentBuilder(Buffer.from(patch), {
              name: Buffer.from(o.id).toString("base64url"),
            }),
          ],
        })
        .then((m) => {
          m.edit({
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setLabel("Show Diff")
                  .setCustomId("show-diff")
                  .setStyle(ButtonStyle.Primary),
              ),
            ],
          });
        });

      break;
    }

    case Events.GuildDelete: {
      let guild: Guild = args["guild"];
      let owner = await guild.fetchOwner();
      let invite: Invite | null = incompatibleInvites.get(guild.id) || null;

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Bot Left Guild`,
            `${guild.client.user.username} left a server, **${guild.name}** with ${guild.memberCount} member${guild.memberCount === 1 ? "" : "s"}\n-# ${guild.id} - Created <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n### Guild Owner\n${owner.user.username} - ${owner.user.id}${invite ? `\n### Invite Link (Bot-Generated)\nhttps://discord.com/invite/${invite.code}` : ""}`,
          ).buildContainer(),
        ],
      });
      break;
    }

    case "honeypotCatch": {
      let member: GuildMember = args["member"];
      let message: Message = args["message"];

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Honeypot Caught Member`,
            `${userMention(member.id)} (${member.id}) sent a message in ${channelMention(config.channels.honeypot)}\n\nThey were timed out for 24 hours\n### Message Content\n\`\`\`${message.content || "Empty"}\`\`\``,
          ).buildContainer(),
        ],
      });

      if (message.deletable) await message.delete();

      break;
    }

    case "dailyQuestionEnded": {
      console.log("DAILY QUESTION ENDED");
      let mode: QuestionModes = args["mode"];
      let question: typeof questions.$inferInsert = args["question"];
      let answersArr: (typeof answers.$inferInsert)[] = args["answersArr"];

      let dbGuild = getDbGuild(config.guild);
      let dbVoters = getAllVoters(question.id);
      let voterOptions: {
        [answerIndex: string]: (typeof voters.$inferInsert)[];
      } = {};

      let modeReadable = modes.find((m) => m.enumValue === mode).name;

      for (const voter of dbVoters) {
        let answer = answersArr.find((a) => a.index === voter.vote_index);
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

      answersArr = answersArr.sort((a, b) => b.votes - a.votes);

      if (dbVoters.length > 0) {
        for (const answer of answersArr) {
          let filteredVoters = dbVoters.filter(
            (v) => v.vote_index === answer.index,
          );
          let isWinning =
            answersArr[0].index === answer.index &&
            answer.votes !== 0 &&
            answersArr[0].votes !== answersArr[1].votes;
          let isRunnerUp =
            answersArr[1].index === answer.index &&
            answer.votes !== 0 &&
            answersArr[0].votes !== answersArr[1].votes;
          console.log("VOTERS (FILT)", filteredVoters);
          votesCont.addTextDisplay(
            `### \`${isWinning ? "🏆 " : isRunnerUp ? "🥈 " : ""}${answer.votes}\` ${answer.answer_text}\n${(await Promise.all(filteredVoters.map(async (v) => `- ${(await client.users.fetch(v.user_id)).username}`))).join("\n")}`,
          );
          votesCont.addSeparator(SeparatorSpacingSize.Small, false);
        }
      } else votesCont.addTextDisplay("Nobody Voted.");

      logChannel.send({
        flags: [MessageFlags.IsComponentsV2],
        components: [
          logContainer(
            `Daily Question #${dbGuild.total_daily_questions} Ended`,
            "The votes have been tallied below:",
          ).buildContainer(),
          votesCont.buildContainer(),
        ],
      });
      break;
    }

    case "reminderDmSubscriptionAdded": {
      let user: User = args["user"];
      let reminder: typeof reminders.$inferInsert = args["reminder"];

      const container = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      container.addTextDisplay(
        `## Subscribed to Reminder\n-# Reminder ID \`${reminder.id}\`\n\nYou have subscribed to DM updates for a reminder. The next reminder will be sent <t:${Math.floor(reminder.next_send_timestamp / 1000)}:R>\n### Reminder Content\n${codeBlock(reminder.content)}`,
      );
      // container.addSeparator();
      // container.addTextDisplay(`-# Click "Snooze" to snooze this reminder`);
      // container.addSeparator(SeparatorSpacingSize.Small, false);
      // await addSnoozeButtons(reminder, container);
      container.addSeparator();
      let bs = [
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Danger,
          "Unsubscribe",
          null,
          { id: (await appEmoji(client, "reminder_unsubscribe")).id },
          parseCustomId(
            createCustomId({
              interactionId: randomUUID(),
              action: `reminder-unsubscribe`,
              command: reminder.id,
            }),
          ),
        ),
      ];

      let allDmUsers = getAllDmUsers(reminder.id);
      let snoozedUntil = allDmUsers.find(
        (u) => u.user_id === user.id,
      ).snoozed_until;

      if (snoozedUntil !== 0 && snoozedUntil >= Date.now())
        bs.push(
          TMComponentBuilder.accessoryButton(
            ButtonStyle.Success,
            "Un-Snooze Reminder",
            null,
            null,
            parseCustomId(
              createCustomId({
                interactionId: randomUUID(),
                action: `reminder-unsnooze`,
                command: reminder.id,
              }),
            ),
          ),
        );

      container.addButtonActionRow(bs);

      user
        .send({
          flags: [MessageFlags.IsComponentsV2],
          components: [container.buildContainer()],
        })
        .catch(() => {
          //oops
        });

      break;
    }

    case "reminderDmSubscriptionRemoved": {
      let user: User = args["user"];
      let reminder: typeof reminders.$inferInsert = args["reminder"] || null;
      let deleted = args["deleted"] || false;

      const container = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      container.addTextDisplay(
        `## Unsubscribed from Reminder\n-# Reminder ID \`${reminder.id}\`\n\nYou have${deleted ? " been" : ""} unsubscribed from DM updates for a reminder${deleted ? " because it was deleted" : ""}.\n\nYou will no longer receive messages regarding this specific reminder.`,
      );
      container.addSeparator();
      if (!deleted)
        container.addButtonActionRow([
          TMComponentBuilder.accessoryButton(
            ButtonStyle.Success,
            "Re-Subscribe",
            null,
            { id: (await appEmoji(client, "reminder_subscribe")).id },
            parseCustomId(
              createCustomId({
                interactionId: randomUUID(),
                action: `reminder-subscribe`,
                command: reminder.id,
              }),
            ),
          ),
        ]);

      user
        .send({
          flags: [MessageFlags.IsComponentsV2],
          components: [container.buildContainer()],
        })
        .catch(() => {
          //oops
        });
      break;
    }

    case "reminderDmNotification": {
      let user: User = args["user"];
      let reminder: typeof reminders.$inferInsert = args["reminder"];

      const container = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      container.addTextDisplay(
        `-# Reminder ID \`${reminder.id}\` | Next Reminder <t:${Math.floor(reminder.next_send_timestamp / 1000)}:R>\n### Reminder Content\n${codeBlock(reminder.content)}`,
      );
      // container.addSeparator();
      // container.addTextDisplay(`-# Click "Snooze" to snooze this reminder`);
      // container.addSeparator(SeparatorSpacingSize.Small, false);
      // await addSnoozeButtons(reminder, container);
      container.addSeparator();
      container.addButtonAccessorySection(
        `You received this message because you are subscribed to this reminder's DM updates.`,
        null,
        null,
        null,
        null,
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Danger,
          "Unsubscribe",
          null,
          { id: (await appEmoji(client, "reminder_unsubscribe")).id },
          parseCustomId(
            createCustomId({
              interactionId: randomUUID(),
              action: `reminder-unsubscribe`,
              command: reminder.id,
            }),
          ),
        ),
      );

      user
        .send({
          flags: [MessageFlags.IsComponentsV2],
          components: [container.buildContainer()],
        })
        .catch(() => {
          //oops
        });

      break;
    }
  }
}

async function addSnoozeButtons(
  reminder: typeof reminders.$inferInsert,
  container: TMComponentBuilder,
): Promise<TMComponentBuilder> {
  let options = [
    { name: "5 Minutes", value: 300 },
    { name: "10 Minutes", value: 600 },
    { name: "30 Minutes", value: 1800 },
    { name: "1 Hour", value: 3600 },
    { name: "3 Hours", value: 3600 * 3 },
    { name: "8 Hours", value: 3600 * 8 },
    { name: "1 Day", value: 3600 * 24 },
  ];

  let differenceSeconds = Math.round(
    Date.now() / 1000 - reminder.next_send_timestamp / 1000,
  );

  options = options.filter((o) =>
    !Number.isNaN(Number(o.value))
      ? true
      : (o.value as number) < differenceSeconds,
  );

  let buttons = [];

  for (const option of options) {
    if (buttons.length < 5) {
      buttons.push(
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Secondary,
          `⏱️ Snooze ${option.name}`,
          null,
          null,
          parseCustomId(
            createCustomId({
              interactionId: randomUUID(),
              action: `reminder-snooze`,
              command: reminder.id,
              subcommand: option.value.toString(),
            }),
          ),
        ),
      );
    } else {
      container.addButtonActionRow(buttons);
      buttons = [
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Secondary,
          `⏱️ snooze ${option.name}`,
          null,
          null,
          parseCustomId(
            createCustomId({
              interactionId: randomUUID(),
              action: `reminder-snooze`,
              command: reminder.id,
              subcommand: option.value.toString(),
            }),
          ),
        ),
      ];
    }
  }

  return container;
}

export const toHHMMSS = (secs: number) => {
  var sec_num = parseInt((secs / 1000).toString(), 10);
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor(sec_num / 60) % 60;
  var seconds = sec_num % 60;

  return [hours, minutes, seconds]
    .map((v) => (v < 10 ? "0" + v : v))
    .filter((v, i) => v !== "00" || i > 0)
    .join(":");
};

let exiting = 0;
const exitHandler = async (reason?: string, gh_issue?: String) => {
  if (exiting < 5) {
    console.log("Exiting!");
    exiting += 1;

    (client.channels.cache.get(config.channels.labs) as GuildTextBasedChannel)
      .send(
        `## ${client.user.displayName} is shutting down${
          reason ? `\n${codeBlock(reason)}` : ""
        }\n> Hostname: \`${os.hostname()}\`\n> Total uptime: **${toHHMMSS(process.uptime() * 1000)}**`,
      )
      .finally(() => {
        process.exit();
      });
  } else {
    console.log("Aborting process!");
    process.abort();
  }
};

process.on("exit", exitHandler.bind(null, null, null));
process.on("SIGINT", exitHandler.bind(null, null, null));
process.on("SIGUSR1", exitHandler.bind(null, null, null));
process.on("SIGUSR2", exitHandler.bind(null, null, null));

// LOGS
//
let logsInitialized = false;
let logsInitInterval;

logsInitInterval = setInterval(() => {
  if (!logsInitialized && client) {
    client.on(Events.ChannelCreate, async (channel) => {
      await logEvent(Events.ChannelCreate, { channel: channel });
    });
    client.on(Events.ChannelDelete, async (channel) => {
      if (!channel.isDMBased())
        await logEvent(Events.ChannelDelete, { channel: channel });
    });
    client.on(Events.ChannelUpdate, async (old_channel, new_channel) => {
      await logEvent(Events.ChannelUpdate, { old_channel, new_channel });
    });
    // client.on(Events.GuildMemberRemove, (member) => { logEvent(Events.GuildMemberRemove, { member }) })
    client.on(Events.GuildUpdate, async (old_guild, new_guild) => {
      await logEvent(Events.GuildUpdate, { old_guild, new_guild });
    });
    client.on(Events.GuildRoleCreate, async (role) => {
      await logEvent(Events.GuildRoleCreate, { role });
    });
    client.on(Events.GuildRoleDelete, async (role) => {
      await logEvent(Events.GuildRoleDelete, { role });
    });
    client.on(Events.GuildRoleUpdate, async (old_role, new_role) => {
      await logEvent(Events.GuildRoleUpdate, { old_role, new_role });
    });
    client.on(Events.AutoModerationRuleCreate, async (rule) => {
      await logEvent(Events.AutoModerationRuleCreate, { rule });
    });
    client.on(Events.AutoModerationRuleUpdate, async (old_rule, new_rule) => {
      await logEvent(Events.AutoModerationRuleUpdate, { old_rule, new_rule });
    });
    client.on(Events.AutoModerationRuleDelete, async (rule) => {
      await logEvent(Events.AutoModerationRuleDelete, { rule });
    });
    client.on(Events.AutoModerationActionExecution, async (execution) => {
      await logEvent(Events.AutoModerationActionExecution, { execution });
    });
    client.on(Events.MessageUpdate, async (old_message, new_message) => {
      await logEvent(Events.MessageUpdate, { old_message, new_message });
    });
    client.on(Events.GuildDelete, async (guild) => {
      await logEvent(Events.GuildDelete, { guild });
    });
    client.on("honeypotCatch", async (member, message) => {
      await logEvent("honeypotCatch", { member, message });
    });
    client.on("dailyQuestionEnded", async (mode, question, answersArr) => {
      await logEvent("dailyQuestionEnded", { mode, question, answersArr });
    });
    client.on("reminderDmSubscriptionAdded", async (user, reminder) => {
      await logEvent("reminderDmSubscriptionAdded", { user, reminder });
    });
    client.on(
      "reminderDmSubscriptionRemoved",
      async (user, reminder, deleted) => {
        await logEvent("reminderDmSubscriptionRemoved", {
          user,
          reminder,
          deleted,
        });
      },
    );
    client.on("reminderDmNotification", async (user, reminder) => {
      await logEvent("reminderDmNotification", { user, reminder });
    });
    initDailyEvents();
    logsInitialized = true;
    console.log("Initialized Logs");
    if (logsInitInterval) clearInterval(logsInitInterval);
  }
}, 1e3);

client.login(process.env.TOKEN);
twitchWs.start();
mongoose
  .connect(process.env.MONGO_URI, { dbName: "duh" })
  .then(() => {
    console.log(`MongoDB Connected`);
  })
  .catch((e) => {
    console.log(`MongoDB Connection Failed`, e);
  });
