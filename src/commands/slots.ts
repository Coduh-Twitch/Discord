import { ApplicationCommandOptionType, Colors, formatEmoji, MessageFlags, SeparatorSpacingSize, userMention, VoiceConnectionStates } from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { userModel } from "../models/user";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { appEmoji } from "../utils/emojiUtils";
import config from "../config";

let rollers: Set<string> = new Set();

const SlotsCommand: Command = {
    enabled: true,
    category: CommandCategory.ECONOMY,
    name: "slots",
    description: "99% of gamblers stop before they win... Just saying.",
    options: [
        {
            name: "amount",
            description: "How many points to roll. \"all\" to go all in!",
            type: ApplicationCommandOptionType.String,
            min_length: 1,
            required: true
        }
    ],
    run: async (interaction) => {
        if(rollers.has(interaction.user.id)) {
            await interaction.reply({content: `${await appEmoji(interaction.client, "timej")} You're already using the slot machine. Don't be like my Grandma, you can't gamble in prison!`, flags: [MessageFlags.Ephemeral]});
            return;
        }
        await interaction.deferReply();
        let amount: number | string = interaction.options.getString("amount", true);
        if(!Number.isNaN(Number(amount))) amount = Number(amount);
        let dbUser = await userModel.findOne({id: interaction.user.id});
        if(Number.isNaN(Number(amount)) && amount === "all") amount = dbUser.points;
        if(Number.isNaN(Number(amount))) return interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [new TMComponentBuilder().setAccentColor(Colors.Red).addTextDisplay(`## ${await appEmoji(interaction.client, "riotj")} What are You Doing?\n${await appEmoji(interaction.client, "what")} You're trying to give me fake money, DO NOT REDEEM IT, DO NOT REDEEM IT!`).buildContainer()]});
        if(Number(amount) < 50 || dbUser.points < 50 || dbUser.points < Number(amount)) return interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [new TMComponentBuilder().setAccentColor(Colors.Red).addTextDisplay(`## ${await appEmoji(interaction.client, "nono")} Not Enough Points\nYou need at least 50 points to gamble, soldier!`).buildContainer()]});

        let rollAmount: number = Math.floor(Number(amount));

        rollers.add(interaction.user.id);

        let previousRoll: string[] = [];

        let winAmount: number = 0;

        let savedR1: string | null = null;
        let savedR2: string | null = null;
        let savedR3: string | null = null;

        async function rollContainer(rolling: boolean, emojis: string[]): Promise<TMComponentBuilder> {
            if(emojis.length > 0) previousRoll = emojis;
            let container = new TMComponentBuilder();
            container.setAccentColor(config.brand_color)
            if(previousRoll.length > 0) {
                let e1 = previousRoll[0];
                let e2 = previousRoll[1];
                let e3 = previousRoll[2];

                let win = false;
                let jackpot = false;

                if(((e1 === e2) || (e2 === e3) || (e1 === e3))) win = true;
                if((e1 === e2) && (e2 === e3) && (e1 === e3)) jackpot = true;

                if(rolling) container.addTextDisplay(`## ${await appEmoji(interaction.client, "pausej")} Rolling...`)
                    if(!rolling) {
                        if(!win && !jackpot) {
                            console.log("LOSER")
                            container.addTextDisplay(`## ${userMention(interaction.user.id)} lost ${amount.toLocaleString()} points ${await appEmoji(interaction.client, "sadgge")}`)
                            dbUser.set("points", dbUser.points - rollAmount);
                            await dbUser.save();
                        }
                        if(win && !jackpot) {
                            console.log("WIN")
                            // winAmount = Math.floor(rollAmount * 0.5);
                            container.addTextDisplay(`## ${await appEmoji(interaction.client, "smokee")} So Close!\nThe house felt bad, so ${userMention(interaction.user.id)} got to keep their ${rollAmount.toLocaleString()} point bet ${await appEmoji(interaction.client, "jiggy")}`)
                            // dbUser.set("points", dbUser.points + winAmount);
                            await dbUser.save();
                        }
                        if(jackpot) {
                            console.log("JACKPOT")
                            winAmount = Math.floor(rollAmount * 1.33);
                            container.addTextDisplay(`## ${await appEmoji(interaction.client, "yay")} You Won!\n${userMention(interaction.user.id)} won the jackpot and got **${winAmount.toLocaleString()}** points! (+${winAmount - rollAmount}) ${await appEmoji(interaction.client, "twerk")}`)
                            dbUser.set("points", dbUser.points + winAmount);
                            await dbUser.save();
                        }

                        rollers.delete(interaction.user.id);
                    }
                    container.addSeparator(SeparatorSpacingSize.Small);
                    container.addTextDisplay(`# | ${(await Promise.all(previousRoll.map(async e => `${await appEmoji(interaction.client, e)}`))).join(" | ")} |`)
                } else {
                    if(rolling) container.addTextDisplay(`## ${await appEmoji(interaction.client, "typej")} Setting up the machine...`)
                    }
                
            return container;
        }

        let appEmojis = await interaction.client.application.emojis.fetch();

        // let emotes = appEmojis.filter(e => !(/[0-9]|color\_/.test(e.name))).map(e => e.name);
        let emotes = ["coduhDummy", "coduhLove", "coduhMad", "coduhNotSmart", "coduhPeekaboo", "coduhPenguin", "coduhPissed", "coduhRaid", "coduhShooter", "coduhTaco", "coduhAyo", "coduhBeg"];
        // emotes = await Promise.all(emotes.map(async e => `${await appEmoji(interaction.client, e)}`));

        await interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [(await rollContainer(true, [])).buildContainer()]})

        let rolls = 0;
        let interval: NodeJS.Timeout;
        interval = setInterval(async () => {
            if(rolls < 3) {
                let rand1 = savedR1 || emotes[Math.floor(Math.random() * emotes.length)];
                let rand2 = savedR2 || emotes[Math.floor(Math.random() * emotes.length)];
                let rand3 = savedR3 || emotes[Math.floor(Math.random() * emotes.length)];

                if(rolls !== 0 && (rand1 === rand3)) {
                    savedR1 = rand1;
                    savedR3 = rand3;
                }
                
                await interaction.editReply({components: [(await rollContainer(true, [rand1,rand2,rand3])).buildContainer()]})
                rolls+=1;
            } else {
                await interaction.editReply({components: [(await rollContainer(false, [])).buildContainer()]})
                savedR1 = null;
                savedR2 = null;
                savedR3 = null;
                clearInterval(interval);
            }
        },2e3)

    }
}

export default SlotsCommand;