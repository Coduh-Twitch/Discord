
import {
    ChatInputApplicationCommandData,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
} from "discord.js";

interface CommandAddons {
    enabled: boolean;
    run: (interaction: ChatInputCommandInteraction) => void;
    autocomplete?: (interaction: AutocompleteInteraction) => void;
}

type BetterCommand = ChatInputApplicationCommandData & CommandAddons;

export interface Command extends BetterCommand { }
