
import {
    ChatInputApplicationCommandData,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    ApplicationCommandOptionData,
} from "discord.js";

export enum CommandCategory {
    DEV="Developer",
    ADMIN="Administrator",
    MOD="Moderator",
    EVENTS="Events",
    ECONOMY="Economy",
    LEVELING="Leveling",
    UTILITY="Utility",
    MISC="Miscellaneous"
}

export enum UserLevel {
    ADMIN="Admin",
    DEV="Developer",
    MOD="Moderator",
    VIP="VIP",
    SUBSCRIBER="Subscriber",
    DEFAULT="Member"
}

interface CommandOptionAddons {
    requiredRole?: UserLevel;
}

type BetterCommandOption = ApplicationCommandOptionData & CommandOptionAddons;

interface CommandAddons {
    enabled: boolean;
    category: CommandCategory;
    requiredRole?: UserLevel;
    helpDescription?: string;
    options?: BetterCommandOption[];
    run: (interaction: ChatInputCommandInteraction) => void;
    autocomplete?: (interaction: AutocompleteInteraction) => void;
}

type BetterCommand = Pick<ChatInputApplicationCommandData, Exclude<keyof ChatInputApplicationCommandData, "options">> & CommandAddons;

export interface Command extends BetterCommand { }
