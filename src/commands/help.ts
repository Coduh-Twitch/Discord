import { ApplicationCommandOptionType, blockQuote, GuildMember, MessageFlags, PermissionFlagsBits, SeparatorSpacingSize } from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command"
import { TMComponentBuilder } from "../classes/ComponentBuilder"
import { globalCommandMap } from "..";
import config from "../config"

const HelpCommand: Command = {
    enabled: true,
    category: CommandCategory.UTILITY,
    helpDescription: "Display this message!",
    name: "help",
    description: "Show a helpful message explaining every command",
    run: async (interaction) => {
        await interaction.deferReply();
        let runner: GuildMember = interaction.guild.members.cache.get(interaction.user.id);
        let isAdmin = runner.permissions.has(PermissionFlagsBits.Administrator, true);
        let isMod = runner.permissions.has([PermissionFlagsBits.ModerateMembers], true);
        let isEventRunner = runner.permissions.has([PermissionFlagsBits.CreateEvents, PermissionFlagsBits.ManageEvents], true);

        let helpCommandMap: Map<CommandCategory, Command[]> = new Map();

        globalCommandMap.forEach(c => helpCommandMap.set(c.category, [...(helpCommandMap.get(c.category) || []), c]))

        console.log(helpCommandMap);

        let helpCommandArray = Array.from(helpCommandMap);

        let commands: Command[] = [];

        for (let i = 0; i < helpCommandMap.size; i++) {
            let cmds: Command[] = helpCommandArray[i][1];

            commands = [...commands, ...(await Promise.all(cmds.map(async (cmd: Command & { id: string; }) => {
                await interaction.client.application.commands.fetch();
                let apiCmd = await interaction.client.application.commands.cache.find(c => c.name === cmd.name);
                cmd.id = apiCmd.id;
                return cmd;
            })))]
        }

        let container = new TMComponentBuilder();
        container.setAccentColor(config.brand_color);

        container.addTextDisplay(`## Help Menu`)

        for (let i = 0; i < helpCommandMap.size; i++) {
            let category = helpCommandArray[i][0];
            let cmds = commands.filter(c => c.category === category).sort((a, b) => a.name.localeCompare(b.name));

            
            async function addCategoryString(cat: CommandCategory) {
                container.addSeparator();
                container.addTextDisplay(`### ${cat} Commands`)
                let cmdStr: string = (await Promise.all(cmds.map(async (cmd: Command & { id: string; }) => {
                    let groups = cmd.options ? cmd.options.filter(o => o.type === ApplicationCommandOptionType.SubcommandGroup) : [];
                    let subcommands = cmd.options ? cmd.options.filter(o => o.type === ApplicationCommandOptionType.Subcommand) : [];
                    
                    let returnStr: string[] = [];
                    
                    if (groups.length <= 0 && subcommands.length <= 0) returnStr.push(`-# - </${cmd.name}:${cmd.id}> - ${(cmd.requiredRole && cmd.requiredRole !== UserLevel.DEFAULT) ? `**[${cmd.requiredRole} Only]** ` : ""}*${cmd.helpDescription || cmd.description}*`);
                    if (groups.length > 0) {
                        groups.forEach(group => {
                            let subs = group.options.filter(o => o.type === ApplicationCommandOptionType.Subcommand);
                            returnStr.push(subs.map(s => `-# - </${cmd.name} ${group.name} ${s.name}:${cmd.id}> - ${((s as any)?.requiredRole && (s as any).requiredRole !== UserLevel.DEFAULT) ? `**[${(s as any).requiredRole} Only]** ` : ""}*${s.description || cmd.description}*`).join("\n"))
                        })
                    }
                    if (subcommands.length > 0) {
                        returnStr.push(subcommands.map(s => `-# - </${cmd.name} ${s.name}:${cmd.id}> - ${(s.requiredRole && s.requiredRole !== UserLevel.DEFAULT) ? `**[${s.requiredRole} Only]** ` : ""}*${s.description || cmd.description}*`).join("\n"))
                    }
                    
                    return returnStr.join("\n");
                }))).join("\n")
                if (cmdStr.length > 0) {
                    container.addSeparator(SeparatorSpacingSize.Small, false);
                    container.addTextDisplay(`${cmdStr}`);
                }
            }
            
            if([CommandCategory.ADMIN, CommandCategory.MOD, CommandCategory.EVENTS, CommandCategory.DEV].includes(category)) {
                if (isMod && category === CommandCategory.MOD) await addCategoryString(category);
                if (isAdmin && ((category === CommandCategory.ADMIN) || (category === CommandCategory.DEV))) await addCategoryString(category);
                if (isEventRunner && category === CommandCategory.EVENTS) await addCategoryString(category);
            } else await addCategoryString(category);
        }

        await interaction.editReply({ flags: [MessageFlags.IsComponentsV2], components: [container.buildContainer()] });
    }
}

export default HelpCommand;