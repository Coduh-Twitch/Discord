import {
  Attachment,
  AttachmentBuilder,
  blockQuote,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  userMention,
} from "discord.js";
import { client } from "..";
import { Command, CommandCategory } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { readFileSync } from "fs-extra";
import { join } from "path";
import { appEmoji } from "../utils/emojiUtils";

async function link(
  name: string,
  emoji: string,
  url: string,
): Promise<ButtonBuilder> {
  let emote = await appEmoji(client, emoji);
  let button = TMComponentBuilder.accessoryButton(ButtonStyle.Link, name, url, {
    id: emote.id,
  });
  return button;
}

const BotInfoCommand: Command = {
  enabled: true,
  name: "botinfo",
  description: "Get information about the bot",
  category: CommandCategory.UTILITY,
  run: async (interaction) => {
    const helpCommand =
      client.application.commands.cache.find((c) => c.name === "help") || null;

    const icon = new AttachmentBuilder(
      readFileSync(join(process.cwd(), "src", "assets", "icon.png")),
    ).setName("icon.png");

    const container = new TMComponentBuilder().setAccentColor(0xc6a037);
    container.addThumbnailAccessorySection(
      `## About ShortBotduh\n-# ${userMention(client.user.id)} • ${client.user.id} • Created <t:${Math.floor(client.user.createdTimestamp / 1000)}:R>\n> ShortBotduh is a custom bot that provides various features to coduh's crib. Some include: points, live notifications, movie event management, and TTS.\n### Commands\nFor a full list of commands, try ${!helpCommand ? `\`/help\`` : `</help:${helpCommand.id}>`}!`,
      null,
      icon,
    );

    container.addSeparator();
    container.addTextDisplay(`### Bot Built by Ducky`);
    container.addButtonActionRow([
      await link("Ko-fi", "kofi", "https://ko-fi.com/duckyyylol"),
      await link("Website", "web", "https://ducky.wiki"),
      await link("GitHub", "github", "https://ducky.wiki/travel/github"),
      await link("Twitch", "twitch", "https://ducky.wiki/travel/twitch"),
    ]);

    interaction.reply({
      flags: [MessageFlags.IsComponentsV2],
      components: [container.buildContainer()],
      files: [icon],
    });
  },
};

export default BotInfoCommand;
