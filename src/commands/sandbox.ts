import { ApplicationCommandOptionType, AttachmentBuilder, blockQuote, ChatInputCommandInteraction, Colors, Events, MessageFlags, PermissionFlagsBits, TextBasedChannel, User, userMention, VoiceBasedChannel } from "discord.js";
import { Command } from "../classes/Command";
import { Canvas, CanvasGradient, CanvasRenderingContext2D, createCanvas, Image } from "canvas";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { memberWelcomeImage } from "../utils/canvasUtils";
import { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnection } from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";
import { join } from "path";
import { readFileSync } from "fs";
import { player } from "..";


let voiceConnection: VoiceConnection | null = null;
let joinedChannel: VoiceBasedChannel | null = null;
let voiceHost: User | null = null;

function utterPath(id: string) {
    return join(process.cwd(), "temp", `utterance_${id}.webm`);
}


const SandboxCommand: Command = {
    enabled: true,
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
    name: "sandbox",
    description: "Testing command",
    options: [
        {
            name: "content",
            description: "content",
            type: ApplicationCommandOptionType.String,
            required: false
        },
        {
            name: "voice",
            description: "voice",
            type: ApplicationCommandOptionType.String,
            choices: [{name: "Christopher (Male)", value: "en-US-ChristopherNeural"}, {name: "Aria (Female)", value: "en-US-AriaNeural"}],
            required: false
        }
    ],
    run: async (interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply({flags: [MessageFlags.Ephemeral]})
        let m = interaction.guild.members.cache.get(interaction.user.id)
        let client = interaction.client;
        let content = interaction.options.getString('content', false);
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

        

        if(voiceConnection && !content) {
            voiceConnection.disconnect();
            voiceConnection.destroy();
            voiceConnection = null;
            if(joinedChannel && joinedChannel.isSendable()) joinedChannel.send({content: `**Goodbye! 👋**`})
            joinedChannel = null;
            return;
        }

        if(m.voice.channelId && !voiceConnection) {
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

            if(joinedChannel.isSendable()) joinedChannel.send({flags: [MessageFlags.IsComponentsV2], components: [sessionBegin.buildContainer()]})

            


            }
        
        if(voiceConnection && content) {
            let utterancePath = utterPath(interaction.id);
            tts.ttsPromise(voiceHost && voiceHost.id !== interaction.user.id ? `${interaction.user.username} said: ${content}` : content, utterancePath).then(v => {
                let res = createAudioResource(utterancePath, {inputType: StreamType.WebmOpus, inlineVolume: true});
                if(res.volume) res.volume.setVolume(1);
                player.play(res);
                player.unpause();
                interaction.editReply({content: `Trying to say \`${content}\``})
            }).catch(e => {
                console.log(e);
                interaction.editReply({content: `Failed to say \`${content}\`${e?.message ? `. Error: ${e.message}` : ""}`})
            })
                
        }

        client.on(Events.VoiceStateUpdate, (o, n) => {
                if(!o.channelId || !voiceConnection) return;
                console.log(o.channelId, n.channelId)
                let oldChannel: VoiceBasedChannel = o.guild.channels.cache.get(o.channelId) as VoiceBasedChannel;
                if(!n.channelId && oldChannel.members.size <= 1) {
                    voiceConnection.disconnect()
                    voiceConnection.destroy()
                    voiceConnection = null;

                    let sessionEnd = new TMComponentBuilder();
                    sessionEnd.setAccentColor(Colors.Red);
                    sessionEnd.addTextDisplay(`## TTS Session Ended\n-# ${userMention(interaction.user.id)} has ended the TTS session in this channel.`)
                    sessionEnd.addSeparator()
                    sessionEnd.addTextDisplay(`Session ended <t:${Math.floor(Date.now() / 1000)}:R>`)

                    if(joinedChannel && joinedChannel.isSendable()) joinedChannel.send({flags: [MessageFlags.IsComponentsV2], components: [sessionEnd.buildContainer()]})
                    joinedChannel = null;
                }
            })

    }
}

export default SandboxCommand;