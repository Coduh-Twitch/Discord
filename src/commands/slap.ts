import {
  ApplicationCommandOptionType,
  MessageFlags,
  userMention,
} from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import config from "../config";

const gifs = [
  "https://static2.klipy.com/ii/c3a19a0b747a76e98651f2b9a3cca5ff/ce/c7/QkTtxshF.gif",
  "https://static2.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/44/63/iid6cGuM.gif",
  "https://static2.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/4b/8c/KinAxkUf.gif",
  "https://static2.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/a3/d9/TrLVQxwe.gif",
  "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f6/a6/egaWnnhLhSi33A.gif",
];

const phrases = [
  "{user} slapped the shit out of __{victim}__!",
  "{user} dealt a heavy blow to __{victim}__!",
  "{user} showed no mercy to __{victim}__!",
];

const SlapCommand: Command = {
  enabled: true,
  name: "slap",
  description: "Show someone how you really feel...",
  options: [
    {
      name: "victim",
      description: "Who would you like to slap?",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  category: CommandCategory.MISC,
  run: async (interaction) => {
    const user = interaction.options.getUser("victim", true);
    const gif = gifs[Math.floor(Math.random() * gifs.length)] || gifs[0];
    const phrase =
      phrases[Math.floor(Math.random() * phrases.length)] || phrases[0];
    const container = new TMComponentBuilder().setAccentColor(
      config.brand_color,
    );
    container.addTextDisplay(
      `### ${phrase.replaceAll("{user}", userMention(interaction.user.id)).replaceAll("{victim}", user.displayName)}`,
    );
    container.addSeparator();
    container.addMediaGallery([{ media: { url: gif } }]);

    await interaction.reply({
      components: [container.buildContainer()],
      flags: [MessageFlags.IsComponentsV2],
    });
  },
};

export default SlapCommand;
