import { ApplicationCommandOptionType, AttachmentBuilder, blockQuote, ChatInputCommandInteraction, cleanContent, Colors, Events, MessageFlags, PermissionFlagsBits, TextBasedChannel, User, userMention, VoiceBasedChannel } from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command";
import { Canvas, CanvasGradient, CanvasRenderingContext2D, createCanvas, Image } from "canvas";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { memberWelcomeImage } from "../utils/canvasUtils";
import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnection } from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";
import { join } from "path";
import { readFileSync } from "fs";
import { player } from "..";

interface Utterance {
    id: string;
    user: string;
    content: string;
}

let voiceConnection: VoiceConnection | null = null;
let joinedChannel: VoiceBasedChannel | null = null;
let voiceHost: User | null = null;
let utteranceQueue: Utterance[] = [];
let utteranceIds: Map<string, string> = new Map(); // content, id
let currentQueueItem = 0;
let run = 0;

function utterPath(id: string) {
    return join(process.cwd(), "temp", `utterance_${id}.webm`);
}


const TTSCommand: Command = {
    enabled: true,
    category: CommandCategory.UTILITY,
    defaultMemberPermissions: [PermissionFlagsBits.SendVoiceMessages],
    name: "tts",
    description: "Text-to-speech commands",
    options: [
        {
            name: "join",
            description: "Start a TTS session in your current voice channel",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.VIP
        },
        {
            name: "leave",
            description: "End the TTS session in your current voice channel",
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "stop",
            description: "Stop the current TTS being played",
            type: ApplicationCommandOptionType.Subcommand,
            requiredRole: UserLevel.MOD
        },
        {
            name: "say",
            description: "Speak through TTS",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "content",
                    description: "content",
                    type: ApplicationCommandOptionType.String,
                    max_length: 1500,
                    min_length: 1,
                    required: true
                },
                {
                    name: "voice",
                    description: "voice",
                    type: ApplicationCommandOptionType.String,
                    choices: [{ name: "Christopher (Male)", value: "en-US-ChristopherNeural" }, { name: "Aria (Female)", value: "en-US-AriaNeural" }],
                    required: false
                }
            ]
        }
    ],
    run: async (interaction: ChatInputCommandInteraction) => {
        run += 1;
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] })
        let m = interaction.guild.members.cache.get(interaction.user.id)
        let client = interaction.client;

        let subcommand = interaction.options.getSubcommand(true);

        // (await interaction.channel.messages.fetch(content)).poll.end()
        const tts = new EdgeTTS({
            voice: interaction.options.getString("voice", false) || "en-US-AriaNeural",
            lang: "en-US",
            outputFormat: "webm-24khz-16bit-mono-opus",
        })

        // let image = await memberWelcomeImage(m);
        // if(image) {
        //     interaction.editReply({files: [image.attachment]})
        // }

        // if(voiceHost !== null && interaction.user.id !== voiceHost.id) {
        //     interaction.reply({flags: [MessageFlags.Ephemeral], content: `${userMention(voiceHost.id)} is currently `})
        //     return;
        // }

        if (subcommand === "stop") {
            if (!m.permissions.has(PermissionFlagsBits.ModerateMembers, true)) return interaction.editReply({ content: `Only Moderators can do this.` });
            if (!voiceConnection || !player || player.state.status !== AudioPlayerStatus.Playing) return interaction.editReply({ content: `There is no active TTS session, or TTS is not playing.` });
            if (!m.voice.channelId) return interaction.editReply({ content: `You must be in a voice channel to do this.` });

            try {
                player.stop();
                interaction.editReply({ content: `Skipped TTS` })
                m.voice.channel.send({ content: `${userMention(interaction.user.id)} skipped the current TTS` })
            } catch (e) {
                console.log(e);
                interaction.editReply({ content: `Failed to skip TTS` })
            }


        }

        if (subcommand === "join") {

            if (voiceConnection) return interaction.editReply({ content: `A TTS session is already active in this channel. Use </tts say:${interaction.commandId}> to speak through TTS.` })
            if (!m.voice.channelId) return interaction.editReply({ content: `You must be in a voice channel to do this.` })

            if (m.voice.channelId && !voiceConnection) {
                voiceConnection = joinVoiceChannel({
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    guildId: interaction.guildId,
                    channelId: m.voice.channelId,
                    selfDeaf: false,
                    selfMute: false,
                })

                voiceConnection.on("stateChange", (o, n) => {
                    console.log("STATE", n.status)
                })

                voiceConnection.subscribe(player);
                joinedChannel = m.voice.channel;
                voiceHost = interaction.user;

                let sessionBegin = new TMComponentBuilder();
                sessionBegin.setAccentColor(Colors.Green);
                sessionBegin.addTextDisplay(`## TTS Session Started\n-# ${userMention(voiceHost.id)} has started a TTS session in this channel.`)
                sessionBegin.addSeparator();
                sessionBegin.addTextDisplay(`### TTS Commands\n${blockQuote(`- </tts say:${interaction.commandId}> - *Speak through TTS*\n- </tts leave:${interaction.commandId}> - *${userMention(voiceHost.id)} or server staff may end this TTS session*`)}`)
                sessionBegin.addSeparator()
                sessionBegin.addTextDisplay(`Session started <t:${Math.floor(Date.now() / 1000)}:R>`)

                if (joinedChannel.isSendable()) joinedChannel.send({ flags: [MessageFlags.IsComponentsV2], components: [sessionBegin.buildContainer()] })
                interaction.editReply({ content: `👍` })




            }
        }

        if (subcommand === "leave") {
            if (!voiceHost || ((voiceHost.id !== interaction.user.id) && !(m.permissions.has(PermissionFlagsBits.ModerateMembers, true)))) return interaction.editReply({ content: `You can not end the current session.` })
            if (voiceConnection) {
                player.stop()
                voiceConnection.disconnect();
                voiceConnection.destroy();
                voiceConnection = null;
                let sessionEnd = new TMComponentBuilder();
                sessionEnd.setAccentColor(Colors.Red);
                sessionEnd.addTextDisplay(`## TTS Session Ended\n-# ${userMention(interaction.user.id)} has ended the TTS session in this channel.`)
                sessionEnd.addSeparator()
                sessionEnd.addTextDisplay(`Session ended <t:${Math.floor(Date.now() / 1000)}:R>`)

                if (joinedChannel && joinedChannel.isSendable()) joinedChannel.send({ flags: [MessageFlags.IsComponentsV2], components: [sessionEnd.buildContainer()] })
                interaction.editReply({ content: `👍` })
                joinedChannel = null;
                return;
            } else return interaction.editReply({ content: `There is no TTS session in your current voice channel` })
        }

        if (subcommand === "say") {
            let content = interaction.options.getString('content', true);
            content = cleanContent(content, interaction.channel);
            if (!voiceConnection) return interaction.editReply({ content: `There is no TTS session in your current voice channel. Start one with </tts join:${interaction.commandId}>` })
            if (content.length > 1500) return interaction.editReply({ content: `TTS is too long (${content.length.toLocaleString()}/1,500)` })
            if (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Buffering) {
                let qp: Utterance = { user: interaction.user.id, content: content, id: crypto.randomUUID() };
                utteranceQueue.push(qp);
                utteranceIds.set(content, qp.id);

                return interaction.editReply({ content: `TTS added to queue at position ${utteranceQueue.indexOf(qp) + 1}/${utteranceQueue.length}` });
                // return interaction.editReply({ content: `A TTS is already playing.\nRun this command again:\n\`\`\`/tts say content:${content}\`\`\`` })
            }
            if (voiceConnection && content) {
                let utteranceId = crypto.randomUUID();
                let utterancePath = utterPath(utteranceId);
                tts.ttsPromise(voiceHost && voiceHost.id !== interaction.user.id ? `${interaction.user.username} said: ${content}` : content, utterancePath).then(v => {
                    let res = createAudioResource(utterancePath, { inputType: StreamType.WebmOpus, inlineVolume: true });
                    if (res.volume) res.volume.setVolume(1);
                    player.play(res);
                    player.unpause();
                    interaction.editReply({ content: `Trying to say \`${content}\`` })
                    interaction.channel.send({ content: `### TTS from ${userMention(interaction.user.id)}\n-# <t:${Math.floor(Date.now() / 1000)}:R>\n${blockQuote(content)}` })
                }).catch(e => {
                    console.log(e);
                    interaction.editReply({ content: `Failed to say \`${content}\`${e?.message ? `. Error: ${e.message}` : ""}` })
                })

            }
        }



        if (run === 1) player.on("stateChange", async (oldState, newState) => {
            console.log("STATE CHANGE", oldState.status, " -> ", newState.status)
            if (oldState.status === AudioPlayerStatus.Playing && newState.status !== AudioPlayerStatus.Playing) {
                if (utteranceQueue[currentQueueItem]) {
                    let queueItem = utteranceQueue[currentQueueItem]
                    console.log("utterance found", queueItem.content)
                    let content = queueItem.content;
                    let utteranceId = utteranceIds.get(content);
                    let utterancePath = utterPath(utteranceId);
                    let user = await interaction.client.users.fetch(queueItem.user);
                    tts.ttsPromise((voiceHost && (voiceHost.id !== queueItem.user)) ? `${user.username} said: ${content}` : content, utterancePath).then(v => {
                        let res = createAudioResource(utterancePath, { inputType: StreamType.WebmOpus, inlineVolume: true });
                        if (res.volume) res.volume.setVolume(1);
                        player.play(res);
                        player.unpause();
                        // interaction.editReply({ content: `Trying to say \`${content}\`` })
                        interaction.channel.send({ content: `### TTS from ${userMention(queueItem.user)}\n-# <t:${Math.floor(Date.now() / 1000)}:R>\n${blockQuote(content)}` })
                    }).catch(e => {
                        console.log(e);
                        interaction.editReply({ content: `Failed to say \`${content}\`${e?.message ? `. Error: ${e.message}` : ""}` })
                    })

                    currentQueueItem += 1;
                    utteranceQueue.shift();
                    if (!utteranceQueue[currentQueueItem]) {
                    console.log("next utterance not found, resetting to 0")
                        currentQueueItem = 0;
                    }
                } else {
                    console.log("utterance not found")
                    currentQueueItem = 0;
                }
            }
        })


        if (run === 1) client.on(Events.VoiceStateUpdate, (o, n) => {
            if (!o.channelId || !voiceConnection) return;
            console.log(o.channelId, n.channelId)
            let oldChannel: VoiceBasedChannel = o.guild.channels.cache.get(o.channelId) as VoiceBasedChannel;
            if (!n.channelId && oldChannel.members.size <= 1) {
                player.stop()
                voiceConnection.disconnect()
                voiceConnection.destroy()
                voiceConnection = null;

                let sessionEnd = new TMComponentBuilder();
                sessionEnd.setAccentColor(Colors.Red);
                sessionEnd.addTextDisplay(`## TTS Session Ended\n-# ${userMention(interaction.user.id)} has ended the TTS session in this channel.`)
                sessionEnd.addSeparator()
                sessionEnd.addTextDisplay(`Session ended <t:${Math.floor(Date.now() / 1000)}:R>`)

                if (joinedChannel && joinedChannel.isSendable()) joinedChannel.send({ flags: [MessageFlags.IsComponentsV2], components: [sessionEnd.buildContainer()] })
                joinedChannel = null;
            }
        })

    }
}

export default TTSCommand;