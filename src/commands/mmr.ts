import {
  ApplicationCommandOptionType,
  codeBlock,
  MessageFlags,
  User,
} from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { GameMode, GameModes } from "../classes/Lounge";
import { lounge } from "..";
import { loadLoungeIcon } from "../utils/assetUtils";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { ordinal_suffix_of } from "../utils/canvasUtils";

const MMRCommand: Command = {
  enabled: true,
  name: "mmr",
  description: "View the Lounge stats of another user",
  category: CommandCategory.UTILITY,
  options: [
    {
      name: "user",
      description: "The user who's stats you want to check",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "game-mode",
      description: "The game mode to view the user's stats in",
      type: ApplicationCommandOptionType.String,
      choices: Object.entries(GameModes).map(([k, v]) => ({
        name: v,
        value: k,
      })),
      required: false,
    },
    {
      name: "season",
      description: "The season to view the user's stats in",
      type: ApplicationCommandOptionType.Integer,
      maxValue: lounge.currentSeason,
      min_value: 1,
      required: false,
    },
  ],
  run: async (interaction) => {
    let user: User | string =
      interaction.options.getString("user", false) || interaction.user;
    if (typeof user === "string" && (user as string).includes("<@")) {
      let mentionSplit = user.split("<@");
      mentionSplit = mentionSplit[1].split(">");

      let id = mentionSplit[0].trim();

      console.log("SPLIT", mentionSplit);
      console.log("ID", id);

      user = interaction.client.users.cache.get(id) || interaction.user;
    }
    const gamemode: GameMode =
      (interaction.options.getString("game-mode", false) as GameMode) ||
      lounge.defaultGameMode;
    const season =
      interaction.options.getInteger("season", false) || lounge.currentSeason;

    try {
      const player =
        typeof user === "string"
          ? await lounge.getPlayerStatsByName(user as string, gamemode, season)
          : await lounge.getPlayerStatsByDiscordId(
              (user as User).id,
              gamemode,
              season,
            );
      if (!player)
        return await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          content: `Could not find player \`${(user as any)?.id ? (user as any).id : user}\`, have they ever played Lounge?`,
        });

      let players = 12;
      if (gamemode === GameMode.MKWORLD_24P) players = 24;

      const leaderboardUrl = `https://lounge.mkcentral.com/mkworld/PlayerDetails/{id}?season=${season}&p=${players}`;

      if (player.mmr === undefined)
        return await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          content: `**${player.name}** has not played ${GameModes[gamemode]} in Season ${season}`,
        });

      player.mmrChanges = player.mmrChanges.filter(
        (c) => c.reason.toLowerCase() === "table",
      );

      const icon = loadLoungeIcon(player.rank);

      const container = new TMComponentBuilder();
      container.addThumbnailAccessorySection(
        `-# MKWorld Lounge - Season ${player.season} - ${GameModes[gamemode]} (${player.eventsPlayed || 0} Mogi${(player.eventsPlayed || 0) === 1 ? "" : "s"} Played)\n## [${player.name} S${player.season} Stats](${leaderboardUrl.replace("{id}", player.playerId.toString())})\n- **MMR**: ${(player.mmr || 3000).toLocaleString()} (Rank #${player.overallRank.toLocaleString()}) \n- **Peak MMR**: ${(player.maxMmr || player.mmr).toLocaleString()}\n- **Rank**: ${player.rank}${player.winRate ? `\n- **Win Rate**: ${Math.round(player.winRate * 100)}%` : ""}${player.averageScore ? `\n- **Average Score**: ${Math.round(player.averageScore * 10) / 10}` : ""}${player.partnerAverage ? `\n- **Partner Avg.**: ${Math.round(player.partnerAverage * 10) / 10}` : ""}`,
        null,
        icon,
      );

      let formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "short",
      });

      let lastMogi = player.mmrChanges?.[0] || null;
      if (lastMogi && season === lounge.currentSeason) {
        let lastMogiFormat: "FFA" | "2v2" | "3v3" =
          lastMogi.partnerScores.length === 0
            ? "FFA"
            : lastMogi.partnerScores.length === 1
              ? "2v2"
              : lastMogi.partnerScores.length === 2
                ? "3v3"
                : "FFA";

        container.addSeparator();
        container.addTextDisplay(
          `### Last Verified Mogi\n-# Verified <t:${Math.floor(new Date(lastMogi.time).getTime() / 1000)}:R> - Tier ${lastMogi.tier} ${lastMogiFormat} - Table ID \`${lastMogi.changeId}\`\n\n- **Score**: ${lastMogi.rank === 1 ? "🥇" : lastMogi.rank === 2 ? "🥈" : lastMogi.rank === 3 ? "🥉" : ""} ${lastMogi.score.toLocaleString()}pt${lastMogi.score === 1 ? "" : "s"} (${ordinal_suffix_of(lastMogi.rank)} of ${lastMogi.numPlayers})\n- **MMR Change**: ${lastMogi.mmrDelta > 0 ? "+" : ""}${lastMogi.mmrDelta}`,
        );
      }

      let resultsStr = [];

      if (player.mmrChanges.length > 0 && season === lounge.currentSeason) {
        for (var i = 0; i < 10; i++) {
          let change = player.mmrChanges[i] || null;
          if (change) {
            let format: "FFA" | "2v2" | "3v3" =
              change.partnerScores.length === 0
                ? "FFA"
                : change.partnerScores.length === 1
                  ? "2v2"
                  : change.partnerScores.length === 2
                    ? "3v3"
                    : "FFA";

            resultsStr.push(
              `${change.mmrDelta > 0 ? "+" : "-"}[${formatter.format(new Date(change.time))}, ${change.changeId}] Tier ${change.tier} ${format} [${change.mmrDelta > 0 ? "+" : ""}${change.mmrDelta.toLocaleString()} MMR -> ${change.newMmr.toLocaleString()}]`,
            );
          }
        }

        container.addSeparator();
        container.addTextDisplay(
          `### Last ${player.mmrChanges.length >= 10 ? "10" : player.mmrChanges.length} Mogi${player.mmrChanges.length === 1 ? "" : "s"}\n\`\`\`diff\n${resultsStr.join("\n")}\`\`\``,
        );
      }

      await interaction.reply({
        flags: [MessageFlags.IsComponentsV2],
        components: [container.buildContainer()],
        files: [icon],
      });
    } catch (e) {
      return await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `Could not find player \`${(user as any)?.id ? (user as any).id : user}\`, have they ever played Lounge?`,
      });
    }
  },
};

export default MMRCommand;
