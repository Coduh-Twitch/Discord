import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonInteraction,
  ButtonStyle,
  codeBlock,
  ComponentType,
  MessageFlags,
  User,
  userMention,
} from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import config from "../config";
import { client } from "..";
import { rpsWinnerImage, rpsHeaderImage } from "../utils/canvasUtils";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { appEmoji } from "../utils/emojiUtils";
import { readFileSync } from "fs-extra";
import { join } from "path";
import { parseCustomId } from "../utils/customIdUtils";
import { userModel } from "../models/user";

const strings = {
  "#OUTCOME_TIE": "Ties aren't supposed to happen...",
  "#OUTCOME_CRUSHES": "{0} crushes {1}",
  "#OUTCOME_CUTS": "{0} cuts {1}",
  "#OUTCOME_SMOTHERS": "{0} smothers {1}",
  "#OUTCOME_POUNDS_OUT": "{0} pounds out {1}",
  "#OUTCOME_COVERS": "{0} covers {1}",
  "#OUTCOME_": "{0} covers {1}",
};

export function i18n(p_key: string, ...sub: any[]) {
  if (!Object.keys(strings).includes(p_key)) return p_key;

  let string = strings[p_key];

  sub.forEach((v, i) => {
    string = string.replace(`{${i}}`, v);
  });

  return string;
}

const players: Map<string, string> = new Map<string, string>(); // Player1, Player2

setInterval(() => {
  players.clear();
}, 300e3);

export namespace RPS {
  export enum Moves {
    ROCK,
    PAPER,
    SCISSORS,
  }

  export const Names = {
    [Moves.ROCK]: "Rock",
    [Moves.PAPER]: "Paper",
    [Moves.SCISSORS]: "Scissors",
  };

  export const Icons = {
    [Moves.ROCK]: "🪨",
    [Moves.PAPER]: "📃",
    [Moves.SCISSORS]: "✂️",
  };

  export const Matchups = {
    [Moves.ROCK]: {
      [Moves.SCISSORS]: "#OUTCOME_POUNDS_OUT",
    },
    [Moves.PAPER]: {
      [Moves.ROCK]: "#OUTCOME_COVERS",
    },
    [Moves.SCISSORS]: {
      [Moves.PAPER]: "#OUTCOME_CUTS",
    },
  };

  export enum Modes {
    RPS_3,
    RPS_15,
  }

  export const Loadouts = {
    [Modes.RPS_3]: [Moves.ROCK, Moves.PAPER, Moves.SCISSORS],
  };

  export enum RoundResult {
    TIE,
    PLAYER_1,
    PLAYER_2,
  }

  export const ResultIcons = {
    [RoundResult.PLAYER_1]: "🔴",
    [RoundResult.PLAYER_2]: "🔵",
    [RoundResult.TIE]: "➖",
  };

  export interface Round {
    player_1_choice: Moves;
    player_2_choice: Moves;
    result: RoundResult;
  }

  export interface Game {
    viewing_results: boolean;
    winner: User | null;
    player_1: User;
    player_2: User | null;
    player_1_backup: User;
    player_2_backup: User;
    rounds: Round[];
    wager: number;
    started_at: number;
    plays: {
      player_1: Moves | null;
      player_2: Moves | null;
    };
  }
}

async function buildRpsContainer(
  game: RPS.Game,
  loadout: RPS.Moves[],
  loading: boolean = false,
  resultString: string | null = null,
  roundWinner: User | null = null,
): Promise<{
  container: TMComponentBuilder;
  attachments: AttachmentBuilder[];
}> {
  console.log("GAME", game);
  let headerImage = !loading ? await rpsHeaderImage(game) : null;
  let winnerImage = game.winner ? await rpsWinnerImage(game) : null;
  let loadingAttachment = {
    attachment: new AttachmentBuilder(
      readFileSync(join(process.cwd(), "src", "assets", "RPSIntro.gif")),
    ).setName("rpsintro.gif"),
    url: "attachment://rpsintro.gif",
  };

  let tiedRounds = game.rounds.filter((r) => r.result === RPS.RoundResult.TIE);
  let nonTiedRounds = game.rounds.filter(
    (r) => r.result !== RPS.RoundResult.TIE,
  );

  let waitingPlayers: User[] = [];
  if (!game.plays.player_1) waitingPlayers.push(game.player_1);
  if (!game.plays.player_2) waitingPlayers.push(game.player_2);

  let player1Score = nonTiedRounds.filter(
    (r) => r.result === RPS.RoundResult.PLAYER_1,
  ).length;
  let player2Score = nonTiedRounds.filter(
    (r) => r.result === RPS.RoundResult.PLAYER_2,
  ).length;

  let container = new TMComponentBuilder();
  if (!loading)
    container.addMediaGallery([{ media: { url: headerImage.url } }]);
  if (winnerImage) {
    container.addMediaGallery([{ media: { url: winnerImage.url } }]);
    container.addSeparator();
    container.addTextDisplay(
      `### Play History\n${codeBlock(`${game.rounds.map((r) => RPS.Icons[r.player_1_choice]).join(" ")} - ${game.winner && game.winner.id === game.player_1.id ? "🏆 " : ""}${game.player_1.displayName} 🔴 (${player1Score})\n\n${game.rounds.map((r) => RPS.ResultIcons[r.result]).join(" ")}\n\n${game.rounds.map((r) => RPS.Icons[r.player_2_choice]).join(" ")} - ${game.winner && game.winner.id === game.player_2.id ? "🏆 " : ""}${game.player_2.displayName} 🔵 (${player2Score})\n\n${game.rounds.map((r, i) => `R${i + 1}`).join(" ")}`)}`,
    );
  } else if (!loading) {
    container.addTextDisplay(
      `-# Rock Paper Scissors • Started <t:${Math.floor(game.started_at / 1000)}:R>`,
    );
    container.addSeparator();
    container.addTextDisplay(
      `-# ${resultString ? "Viewing Round Results..." : `${waitingPlayers.length > 0 ? `Waiting for **${waitingPlayers.length > 1 ? `${waitingPlayers.length} players` : waitingPlayers[0].displayName}** to play...` : `Both players have played!`}`}`,
    );
    if (!resultString) {
      container.addTextDisplay(
        `## ${await appEmoji(client, "1_")} [${player1Score}] ${game.player_1.displayName} ${game.plays.player_1 ? "✅" : `${await appEmoji(client, "loading")}`}\n## ${await appEmoji(client, "2_")} [${player2Score}] ${game.player_2.displayName} ${game.plays.player_2 ? "✅" : `${await appEmoji(client, "loading")}`}\n### First to 3 points wins${game.wager ? ` ${game.wager.toLocaleString()} ${config.point_name(true, true)}${game.wager === 1 ? "" : "s"}` : ""}!`,
      );
    } else {
      // container.addTextDisplay(
      //   `## ${await appEmoji(client, "1_")} ${game.player_1.displayName} ${RPS.Icons[game.plays.player_1]}\n## ${await appEmoji(client, "2_")} ${game.player_2.displayName} ${RPS.Icons[game.plays.player_2]}`,
      // );
      container.addTextDisplay(
        `## ❗ ${resultString}\n${roundWinner ? `${roundWinner.username} wins this round!` : "It's a tie!"}`,
      );
    }
    container.addSeparator();
    container.addTextDisplay(`### Click to Play`);
    container.addButtonActionRow(
      loadout.map((m) =>
        TMComponentBuilder.accessoryButton(
          resultString ? ButtonStyle.Secondary : ButtonStyle.Primary,
          RPS.Names[m],
          null,
          { name: RPS.Icons[m] },
          {
            interactionId: "rps",
            action: RPS.Names[m].toLowerCase(),
            command: m.toString(),
          },
        ).setDisabled(resultString ? true : false),
      ),
    );
    container.addSeparator();
    container.addTextDisplay(`-# Click here to leave the game`);
    container.addButtonActionRow([
      TMComponentBuilder.accessoryButton(
        ButtonStyle.Danger,
        "Leave Game",
        null,
        null,
        {
          interactionId: "rps",
          action: "leave",
        },
      ).setDisabled(resultString ? true : false),
    ]);
  } else if (loading) {
    container.addMediaGallery([{ media: { url: loadingAttachment.url } }]);
  }

  if (!winnerImage) {
    container.addSeparator();
    container.addTextDisplay(
      `-# **${game.player_1.displayName}** vs **${game.player_2.displayName}** • Round ${(nonTiedRounds.length || 0) + 1} (${tiedRounds.length} tie${tiedRounds.length === 1 ? "" : "s"})`,
    );
  }

  let attachments = [];
  if (headerImage) attachments.push(headerImage.attachment);
  if (winnerImage) attachments.push(winnerImage.attachment);
  if (loading) attachments.push(loadingAttachment.attachment);

  return { container, attachments };
}

const RPSCommand: Command = {
  enabled: true,
  name: "rps",
  description: "Play Rock-Paper-Scissors",
  category: CommandCategory.ECONOMY,
  options: [
    {
      name: "opponent",
      description: "Who would you like to play against?",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: "wager-amount",
      description: `Would you like to put up ${config.point_name(true, true)}s for this game?`,
      type: ApplicationCommandOptionType.Integer,
      required: false,
    },
  ],
  run: async (interaction) => {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    let player = client.users.cache.get(interaction.user.id);
    let dbPlayer = await userModel.findOne({ id: player.id });
    let opponent =
      interaction.options.getUser("opponent", false) || client.user;
    let dbOpponent = await userModel.findOne({ id: opponent.id });
    let wager = interaction.options.getInteger("wager-amount", false) || 0;

    let mode = RPS.Modes.RPS_3;
    let loadout = RPS.Loadouts[mode];

    let confirm = false;

    if (players.has(player.id))
      return await interaction.editReply({
        content: `${await appEmoji(client, "nono")} You are already playing against ${userMention(players.get(player.id))}.`,
      });

    players.set(player.id, opponent.id);
    players.set(opponent.id, player.id);

    if (opponent.id === client.user.id && wager > 0) {
      return await interaction.editReply({
        content: `${await appEmoji(client, "nono")} You can not wager against the bot opponent.`,
      });
    } else {
      if (wager && (dbPlayer.points || 0) < wager)
        return interaction.editReply({
          content: `${await appEmoji(client, "nono")} You don't have enough ${config.point_name(true, true)}s!`,
        });
      if (wager && (dbOpponent.points || 0) < wager)
        return interaction.editReply({
          content: `${await appEmoji(client, "nono")} ${userMention(opponent.id)} doesn't have enough ${config.point_name(true, true)}s!`,
        });

      if (opponent.id === client.user.id) confirm = true;

      let expirationMs = 30e3;
      let expiresAtReadable = Math.floor((Date.now() + expirationMs) / 1000);

      const confirmContainer = new TMComponentBuilder().setAccentColor(
        config.brand_color,
      );
      confirmContainer.addTextDisplay(
        `## Confirm RPS Game\n${userMention(opponent.id)}, ${userMention(player.id)} is challenging you to a game of Rock-Paper-Scissors! ${wager > 0 ? `There ${wager === 1 ? "is" : "are"} ${wager.toLocaleString()} ${config.point_name(true, true)}${wager === 1 ? "" : "s"} up for grabs this game! (**The loser will lose ${wager.toLocaleString()} ${config.point_name(true, true)}${wager === 1 ? "" : "s"}**)` : `There are no ${config.point_name(true, true)}s up for grabs this game. Just for fun!`}\n### Press to Confirm or Deny This Game`,
      );
      confirmContainer.addButtonActionRow([
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Success,
          "Confirm",
          null,
          null,
          { interactionId: interaction.id, action: "confirm-rps" },
        ),
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Danger,
          "Deny",
          null,
          null,
          { interactionId: interaction.id, action: "deny-rps" },
        ),
      ]);

      confirmContainer.addSeparator();
      confirmContainer.addTextDisplay(
        `-# This interaction expires <t:${expiresAtReadable}:R>`,
      );

      let confirmRes = confirm
        ? null
        : await interaction.channel.send({
            flags: [MessageFlags.IsComponentsV2],
            components: [confirmContainer.buildContainer()],
          });

      let confirmInt: ButtonInteraction | null;
      if (confirmRes) {
        confirmInt = await confirmRes
          .awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === opponent.id,
            time: expirationMs,
          })
          .catch(() => (confirmInt = null));
      } else confirmInt = null;

      if (!confirmInt && !confirm) {
        players.delete(player.id);
        players.delete(opponent.id);
        return await confirmRes.edit({
          components: [
            TMComponentBuilder.errorContainer(false).buildContainer(),
          ],
        });
      }
      if (confirmInt && confirmInt.customId.includes("deny-rps") && !confirm) {
        players.delete(player.id);
        players.delete(opponent.id);
        return await confirmRes.edit({
          components: [
            TMComponentBuilder.errorContainer(
              true,
              `**${opponent.displayName}** denied the RPS game.`,
            ).buildContainer(),
          ],
        });
      }
      if (
        (confirmInt && confirmInt.customId.includes("confirm-rps")) ||
        confirm
      )
        if (confirmRes && confirmRes.deletable) await confirmRes.delete();
      return await runGame();
    }

    // if (!confirm) return;

    async function runGame() {
      let game: RPS.Game = {
        viewing_results: false,
        winner: null,
        player_1: player,
        player_2: opponent,
        player_1_backup: player,
        player_2_backup: opponent,
        wager: wager,
        rounds: [],
        started_at: Date.now(),
        plays: {
          player_1: null,
          player_2: null,
        },
      };

      let { container, attachments } = await buildRpsContainer(
        game,
        loadout,
        true,
      );

      interaction.channel
        .send({
          flags: [MessageFlags.IsComponentsV2],
          components: [container.buildContainer()],
          files: attachments,
        })
        .then(async (reply) => {
          if (!interaction.replied && interaction.isRepliable())
            await interaction.editReply({
              content: `Please continue in the game embed: ${reply.url}`,
            });

          setTimeout(async () => {
            const loaded = await buildRpsContainer(game, loadout);
            await reply.edit({
              files: loaded.attachments,
              components: [loaded.container.buildContainer()],
            });
          }, 3e3);

          const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) =>
              game.player_1.id === i.user.id || game.player_2.id === i.user.id,
          });

          let moves: Record<string, RPS.Moves | null> = {
            [game.player_1.id]: null,
            [game.player_2.id]: null,
          };

          collector.on("collect", async (button) => {
            await button.deferUpdate();
            if (game.winner) return;
            // await button.update({
            //     flags: [MessageFlags.Ephemeral],
            //     content: `${await appEmoji(client, "nono")} A winner has already been decided. You can no longer play.`,
            //   });

            let userMove = moves[button.user.id];

            if (userMove) return;
            // await button.editReply({
            //     content: `${await appEmoji(client, "nono")} You have already played ${RPS.Icons[userMove]} **${RPS.Names[userMove]}**`,
            //   });

            let customId = parseCustomId(button.customId);

            if (customId.action === "leave") {
              function getPlayers(): User[] {
                return [
                  game.player_1 && game.player_1.id === client.user.id
                    ? null
                    : game.player_1,
                  game.player_2 && game.player_2.id === client.user.id
                    ? null
                    : game.player_2,
                ].filter((p) => p !== null && p && p.id !== client.user.id);
              }

              if (game.player_1.id === button.user.id)
                game.player_1 =
                  game.player_2.id === client.user.id ? null : client.user;
              if (game.player_2.id === button.user.id)
                game.player_2 =
                  game.player_1.id === client.user.id ? null : client.user;

              let playersArr = getPlayers();

              if (playersArr.length !== 0) {
                await reply.reply({
                  content: `${userMention(button.user.id)} left the game. It's ${userMention(playersArr[0].id)} vs ${userMention(client.user.id)} now!`,
                });

                let movedContainer = await buildRpsContainer(game, loadout);

                await reply.edit({
                  components: [movedContainer.container.buildContainer()],
                  files: movedContainer.attachments,
                });
              } else {
                players.delete(game.player_1_backup.id);
                players.delete(game.player_2_backup.id);

                await reply.edit({
                  components: [
                    TMComponentBuilder.errorContainer(
                      true,
                      `Both players have left the game and it has been cancelled.`,
                    ).buildContainer(),
                  ],
                });
              }

              return;
            }

            let move: RPS.Moves = parseInt(customId.command);

            moves[button.user.id] = move;
            if (button.user.id === game.player_1.id) game.plays.player_1 = move;
            if (button.user.id === game.player_2.id) game.plays.player_2 = move;

            if (game.player_2.id === client.user.id) {
              let randomPlay =
                loadout[Math.floor(Math.random() * loadout.length)] ||
                loadout[0];
              for (var i = 0; i < 10; i++) {
                randomPlay =
                  loadout[Math.floor(Math.random() * loadout.length)] ||
                  loadout[0];
              }
              moves[client.user.id] = randomPlay;
              game.plays.player_2 = randomPlay;
            }

            if (game.player_1.id === client.user.id) {
              let randomPlay =
                loadout[Math.floor(Math.random() * loadout.length)] ||
                loadout[0];
              for (var i = 0; i < 10; i++) {
                randomPlay =
                  loadout[Math.floor(Math.random() * loadout.length)] ||
                  loadout[0];
              }
              moves[client.user.id] = randomPlay;
              game.plays.player_1 = randomPlay;
            }

            // /*
            if (
              moves[game.player_1.id] !== null &&
              moves[game.player_2.id] !== null
            ) {
              let play1 = moves[game.player_1.id];
              let play2 = moves[game.player_2.id];

              moves[game.player_1.id] = null;
              moves[game.player_2.id] = null;

              let result =
                RPS.Matchups[play1]?.[play2] ||
                null ||
                RPS.Matchups[play2]?.[play1] ||
                null ||
                null;
              let play1Win = RPS.Matchups[play1]?.[play2] ? true : false;
              let play2Win = RPS.Matchups[play2]?.[play1] ? true : false;
              let gameResult = play1Win
                ? RPS.RoundResult.PLAYER_1
                : play2Win
                  ? RPS.RoundResult.PLAYER_2
                  : RPS.RoundResult.TIE;

              let winningPlay = play1Win ? play1 : play2Win ? play2 : null;
              let losingPlay = play2Win ? play1 : play1Win ? play2 : null;
              let tie = !winningPlay && !losingPlay;
              let winner = play1Win
                ? game.player_1
                : play2Win
                  ? game.player_2
                  : null;

              // if (!result) return;

              console.log("PLAY 1 WIN", play1Win);
              console.log("PLAY 2 WIN", play2Win);
              console.log("RESULT", result);
              console.log("GAME RESULT", gameResult);
              console.log("WINNING PLAY", winningPlay);
              console.log("LOSING PLAY", losingPlay);

              let resultStr = i18n(result || "#OUTCOME_TIE");
              console.log("RESULT STR (pre replace)", resultStr);
              if (winner) {
                console.log("RUNNING REPLACE");
                resultStr = resultStr.replace("{0}", RPS.Names[winningPlay]);
                resultStr = resultStr.replace("{1}", RPS.Names[losingPlay]);
              }
              console.log("RESULT STR (post replace)", resultStr);
              // if (!game.viewing_results) {
              game.viewing_results = true;
              game.rounds = [
                ...game.rounds,
                {
                  player_1_choice: play1,
                  player_2_choice: play2,
                  result: gameResult,
                },
              ];
              console.log("ROUNDS POST SET", game.rounds);

              let newRounds = game.rounds;

              let movedContainer = await buildRpsContainer(
                game,
                loadout,
                false,
                resultStr,
                winner || null,
              );

              await reply.edit({
                components: [movedContainer.container.buildContainer()],
                files: movedContainer.attachments,
              });

              // }
              //
              reply
                .edit({
                  components: [movedContainer.container.buildContainer()],
                  files: movedContainer.attachments,
                })
                .then(async () => {
                  // await button.editReply({
                  //   content: `You played ${RPS.Icons[move]} **${RPS.Names[move]}**`,
                  // });

                  setTimeout(async () => {
                    let nonTiedRounds = game.rounds.filter(
                      (r) => r.result !== RPS.RoundResult.TIE,
                    );

                    let player1Score = nonTiedRounds.filter(
                      (r) => r.result === RPS.RoundResult.PLAYER_1,
                    ).length;
                    let player2Score = nonTiedRounds.filter(
                      (r) => r.result === RPS.RoundResult.PLAYER_2,
                    ).length;

                    if (player1Score >= 3) game.winner = game.player_1;
                    if (player2Score >= 3) game.winner = game.player_2;

                    let loser =
                      game.winner === game.player_1
                        ? game.player_2
                        : game.player_1;

                    game.plays.player_1 = null;
                    game.plays.player_2 = null;
                    game.rounds = newRounds;

                    if (game.winner) {
                      players.delete(game.player_1.id);
                      players.delete(game.player_1.id);

                      if (game.wager && game.wager > 0) {
                        await reply.reply({
                          content: `${userMention(game.winner.id)} won the game${game.player_1.id !== client.user.id && game.player_2.id !== client.user.id ? ` and took ${wager.toLocaleString()} ${config.point_name(true, true)}${wager === 1 ? "" : "s"} from ${userMention(loser.id)}! ${await appEmoji(client, "smokee")}` : "!"}`,
                        });
                        if (
                          game.player_1.id !== client.user.id &&
                          game.player_2.id !== client.user.id
                        ) {
                          let dbWinner = await userModel.findOne({
                            id: game.winner.id,
                          });
                          let dbLoser = await userModel.findOne({
                            id: loser.id,
                          });

                          dbWinner.set("points", dbWinner.points + game.wager);
                          dbLoser.set("points", dbLoser.points - game.wager);

                          await dbWinner.save();
                          await dbLoser.save();
                        } else game.wager = 0;
                      }
                    }

                    movedContainer = await buildRpsContainer(game, loadout);

                    await reply.edit({
                      components: [movedContainer.container.buildContainer()],
                      files: movedContainer.attachments,
                    });
                    game.viewing_results = false;
                  }, 3e3);
                });
            } else {
              let movedContainer = await buildRpsContainer(game, loadout);

              await reply.edit({
                components: [movedContainer.container.buildContainer()],
                files: movedContainer.attachments,
              });
            }
            // */

            // let movedContainer = await buildRpsContainer(game, loadout);
          });

          collector.on("end", async (col, reason) => {
            console.log(`collector ended for reason ${reason}`);
          });

          // setInterval(async () => {}, 1e3);
        });
    }
  },
};

export default RPSCommand;
