import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import { lounge } from "..";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { TableTeam } from "../classes/Lounge";

const TableCommand: Command = {
  enabled: true,
  name: "table",
  description: "View Lounge tables",
  category: CommandCategory.UTILITY,
  options: [
    {
      name: "table-id",
      description: "Which table would you like to view?",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  run: async (interaction) => {
    const defaultPlayer = await lounge.getPlayerStatsByDiscordId(
      interaction.user.id,
    );
    let tableId = interaction.options.getString("table-id", false) || null;
    if (!tableId) {
      let lastMogi =
        defaultPlayer.mmrChanges.filter(
          (c) => c.reason.toLowerCase() === "table",
        )?.[0] || null;
      if (lastMogi) {
        tableId = lastMogi.changeId.toString();
      }
    }

    if (!tableId)
      return await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `Could not find table.`,
      });

    const table = await lounge.getTable(tableId);
    if (!table)
      return await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `Could not find table with ID \`${tableId}\`.`,
      });

    console.log(table);

    const reporter = await lounge.getPlayerStatsByDiscordId(table.authorId);
    const container = new TMComponentBuilder();
    container.addTextDisplay(
      `-# Table ID \`${table.id}\` - Updated <t:${Math.floor(new Date(table.verifiedOn).getTime() / 1000)}:R>\n## S${table.season} Tier ${table.tier} ${table.format}\n- **Reporter**: ${reporter.name}\n- **Table Created**: <t:${Math.floor(new Date(table.createdOn).getTime() / 1000)}:f>\n- **Table Verified**: <t:${Math.floor(new Date(table.verifiedOn).getTime() / 1000)}:f>`,
    );

    let resultsStr = [];

    let teamSize = table.teams[0].scores.length || 1;
    console.log("TEAM SIZE", teamSize);

    for (const team of table.teams.sort(
      (a: TableTeam, b: TableTeam) => a.rank - b.rank,
    )) {
      let i = 0;
      for (const score of (team as TableTeam).scores) {
        i++;
        resultsStr.push(
          `${score.delta > 0 ? "+" : "-"} ${score.playerName} [${score.prevMmr} -> ${score.newMmr}] (${score.delta > 0 ? "+" : ""}${score.delta})${score.playerDiscordId === interaction.user.id ? " < YOU" : ""}`,
        );
      }
    }

    container.addSeparator();
    container.addTextDisplay(
      `### MMR Changes\n\`\`\`diff\n${resultsStr.map((r, i) => `${r}${(i + 1) % teamSize === 0 && teamSize > 1 ? "\n" : ""}`).join("\n")}\`\`\``,
    );

    container.addMediaGallery([{ media: { url: table.url } }]);

    container.addSeparator();
    container.addTextDisplay(`-# Requested by ${interaction.user.username}`);

    interaction.reply({
      flags: [MessageFlags.IsComponentsV2],
      components: [container.buildContainer()],
    });
  },
};

export default TableCommand;
