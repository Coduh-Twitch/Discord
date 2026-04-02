import { ComponentType, Interaction } from "discord.js";

export type TowerMaidenInteractionInfo = {
    command?: string;
    subcommandGroup?: string;
    subcommand?: string;
    componentType?: ComponentType;
    action: string;
    interactionId: string;
}

export function createCustomId(data: TowerMaidenInteractionInfo) {
    return `${data.command ? `${data.command}` : ""}.${data.subcommandGroup ? `${data.subcommandGroup}` : ""}.${data.subcommand ? `${data.subcommand}` : ""}.${data.componentType ? `${Object.values(ComponentType)[data.componentType - 1]}` : ""}.${data.action}#${data.interactionId}`
}

export function generateCustomId(interaction: Interaction, action: string, componentType?: ComponentType) {
    let data: TowerMaidenInteractionInfo = {
        action,
        interactionId: interaction.id
    }

    if (componentType) data.componentType = componentType

    if (interaction.isChatInputCommand()) {
        data.command = interaction.commandName
        if (interaction.options.getSubcommandGroup(false)) data.subcommandGroup = interaction.options.getSubcommandGroup(false)
        if (interaction.options.getSubcommand(false)) data.subcommand = interaction.options.getSubcommand(false)
    }

    return createCustomId(data)
}

export function parseCustomId(id: string, failHard = true) {
    const hashSplit = id.split("#")
    if (hashSplit.length < 2) {
        if (failHard) throw new Error(`Invalid custom ID: ${id}`)
        return null;
    }

    const headerData = hashSplit[0].split(".")
    if (hashSplit.length == 0) {
        if (failHard) throw new Error(`Invalid custom ID: ${id}`)
        return null;
    }

    let data: TowerMaidenInteractionInfo = {
        interactionId: hashSplit[1],
        action: headerData[headerData.length - 1]
    }

    if (headerData[0].length > 0) data.command = headerData[0]
    if (headerData[1].length > 0) data.subcommandGroup = headerData[1]
    if (headerData[2].length > 0) data.subcommand = headerData[2]
    if (headerData[3].length > 0) data.componentType = Object.values(ComponentType).indexOf(headerData[3]) + 1

    return data;
}
