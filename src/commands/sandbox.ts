import { ApplicationCommandOptionType, AttachmentBuilder, blockQuote, ChatInputCommandInteraction, Colors, Events, MessageFlags, PermissionFlagsBits, TextBasedChannel, User, userMention, VoiceBasedChannel } from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command";
import { Canvas, CanvasGradient, CanvasRenderingContext2D, createCanvas, Image } from "canvas";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { memberWelcomeImage } from "../utils/canvasUtils";
import { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnection } from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";
import { join } from "path";
import { readFileSync } from "fs";
import { player } from "..";
import { userModel } from "../models/user";
import config from "../config";


let voiceConnection: VoiceConnection | null = null;
let joinedChannel: VoiceBasedChannel | null = null;
let voiceHost: User | null = null;

function utterPath(id: string) {
    return join(process.cwd(), "temp", `utterance_${id}.webm`);
}


const SandboxCommand: Command = {
    enabled: true,
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
        }
    ],
    run: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({flags: [MessageFlags.Ephemeral]})
        let user = interaction.options.getUser("user", false);
        let m = interaction.guild.members.cache.get(user ? user.id : interaction.user.id)

        if(m.user.bot) {
            return interaction.editReply({files: [(await memberWelcomeImage(m)).attachment]})
        }
        
        let dbUser = await userModel.findOne({id: m.id});

        if(dbUser) dbUser.set("shownWelcomeMessage", false);
        if(dbUser) await dbUser.save();

        if(m.roles.cache.has(config.roles.members)) {
            m.roles.remove(config.roles.members).then(() => {
                m.roles.add(config.roles.members);
            })
        }
    }
}

export default SandboxCommand;