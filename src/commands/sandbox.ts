import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  blockQuote,
  ChatInputCommandInteraction,
  Colors,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  TextBasedChannel,
  User,
  userMention,
  VoiceBasedChannel,
} from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command";
import {
  Canvas,
  CanvasGradient,
  CanvasRenderingContext2D,
  createCanvas,
  Image,
} from "canvas";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { memberWelcomeImage, wouldYouRatherImage } from "../utils/canvasUtils";
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
} from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";
import { dev_mode, player } from "..";
import { userModel } from "../models/user";
import config from "../config";
import { calculateGivenXP, calculateRequiredXP } from "../utils/xpUtils";
import { appendFileSync, createReadStream, ensureFileSync } from "fs-extra";
import { get } from "axios";
import os from "node:os";

let voiceConnection: VoiceConnection | null = null;
let joinedChannel: VoiceBasedChannel | null = null;
let voiceHost: User | null = null;

function utterPath(id: string) {
  return join(process.cwd(), "temp", `utterance_${id}.webm`);
}

function randomString(max: number = 100): string {
  let chars = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
  ];
  let toReturn = "";

  for (var i = 0; i <= max; i++) {
    toReturn += chars[Math.floor(Math.random() * chars.length)] || "a";
  }

  return toReturn;
}

const SandboxCommand: Command = {
  enabled: os.hostname() === "ducky",
  category: CommandCategory.DEV,
  requiredRole: UserLevel.DEV,
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  name: "sandbox",
  description: "Testing command",
  options: [
    {
      name: "user",
      description: "user",
      type: ApplicationCommandOptionType.User,
    },
  ],
  run: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    let user = interaction.options.getUser("user", false);
    // let m = interaction.guild.members.cache.get(user ? user.id : interaction.user.id)

    // if(m.user.bot) {
    //     return interaction.editReply({files: [(await memberWelcomeImage(m)).attachment]})
    // }

    // let dbUser = await userModel.findOne({id: m.id});

    // if(dbUser) dbUser.set("shownWelcomeMessage", false);
    // if(dbUser) await dbUser.save();

    // if(m.roles.cache.has(config.roles.members)) {
    //     m.roles.remove(config.roles.members).then(() => {
    //         m.roles.add(config.roles.members);
    //     })
    // }

    // let cont = new TMComponentBuilder();

    // let str = [];

    // for(var ii = 1; ii <= 100; ii++) {
    //     str.push(`- Level ${ii}: ${calculateRequiredXP(ii).toLocaleString()} XP`)
    // }

    // let max = 500;
    // let totalXp = 0;
    // let totalCharacters = 0;

    // let filePath = join(process.cwd(), "xp-report.txt")
    // ensureFileSync(filePath);
    // writeFileSync(filePath, "", {encoding: "utf-8"});

    // for(var i = 1; i <= max; i++) {
    //     let randStr = randomString(Math.floor(Math.random() * 100));
    //     let xpGiven = calculateGivenXP(randStr);
    //     let logStr = `${i === 1 ? `---` : ""}\nContent: ${randStr}\nLength: ${randStr.length}\nXP Given: ${xpGiven}\n---`;
    //     // cont.addTextDisplay(`**Message Length**: ${randStr.length}\n**XP Given**: ${xpGiven.toLocaleString()}`)
    //     // cont.addSeparator();
    //     totalXp+=xpGiven;
    //     totalCharacters+=randStr.length;

    //     appendFileSync(filePath, logStr, {encoding: "utf8"});
    // }

    // let finalStr = `\nTotal XP Given: ${totalXp}\nTotal Messages: ${max}\nTotal Characters: ${totalCharacters}`;

    // appendFileSync(filePath, finalStr, {encoding: "utf8"});
    // appendFileSync(filePath, `\n---\nLevel Requirements:\n${str.join("\n")}\nEND`)

    // let file = createReadStream(filePath);
    // let attachment = new AttachmentBuilder(file).setName("xp-report.txt");

    // cont.addTextDisplay(`-# XP Review\n\n**Total XP Given:** ${totalXp.toLocaleString()}\n**Total Messages**: ${max}\n**Total Characters:** ${totalCharacters.toLocaleString()}`)
    // cont.addSeparator();
    // cont.addFile("attachment://xp-report.txt")
    // cont.addTextDisplay(`-# Saved to \`${filePath}\``)

    // interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [cont.buildContainer()], files: [attachment]})
    //
    let image = await wouldYouRatherImage(1021, [
      {
        answer_text: "10 extra limbs on yur body gng",
        index: 1,
        question_id: "99",
        votes: 5,
      },
      {
        answer_text: "fingers gone",
        index: 2,
        question_id: "99",
        votes: 12,
      },
    ]);
    interaction.channel.send({ files: [image.attachment] });
  },
};

export default SandboxCommand;
