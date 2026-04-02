import { BaseInteraction, ButtonInteraction, ChatInputCommandInteraction, codeBlock, Message, MessageFlags } from "discord.js";
import { join } from "path";
import { desiredExt, dev_mode } from "..";
import { twitchCustomCommandModel } from "../models/twitchCustomCommand";
import { existsSync } from "fs-extra";
import config from "../config";
import { TemporaryFile } from "../classes/TemporaryFile";
import { TMComponentBuilder } from "../classes/ComponentBuilder";

export default {
    enabled: true,
    run: async (int: BaseInteraction) => {
        async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
            console.log("IS DEV MODE", dev_mode)
            if(interaction.commandName && interaction.commandName !== null) {
                let path = dev_mode ? join(process.cwd(), `src`, "commands",  `${interaction.commandName}${desiredExt}`) : join(process.cwd(), `dist`, `src`, "commands",  `${interaction.commandName}${desiredExt}`)
                console.log("PATH", path)
                console.log("EXISTS", existsSync(path))
                if(existsSync(path)) {
                    const cmd = (require(`../commands/${interaction.commandName}${desiredExt}`)).default;
                    console.log(cmd);
                    if(cmd && cmd.enabled && cmd.run) await cmd.run(interaction);
                    return;

                } else {
                    const customCmd = await twitchCustomCommandModel.findOne({trigger: `!${interaction.commandName}`});

                    if(customCmd) {
                        interaction.reply({content: customCmd.content});
                    }
                }
            }
        }

        async function handleButtonPress(interaction: ButtonInteraction) {
            if(interaction.customId === "show-diff") {
                
                
                let m = await interaction.channel.messages.fetch(interaction.message.id);
                console.log(interaction.message.attachments)
                if(!m || m?.attachments?.size <= 0) return;
                console.log(m);
                const tempFile = await TemporaryFile.create(m.attachments.at(0).url)
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

                        hp = codeBlock("diff", hp)

                        let diffContainer = new TMComponentBuilder();
                        diffContainer.addTextDisplay(`### Message Edited | Diff`)
                        diffContainer.addTextDisplay(hp);

                        await interaction.reply({
                            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
                            components: [diffContainer.buildContainer()]
                        })
                        tempFile.free()

            }
        }

        if(int.isChatInputCommand()) return await handleSlashCommand(int as ChatInputCommandInteraction);
        if(int.isButton()) return await handleButtonPress(int as ButtonInteraction);
    }
}