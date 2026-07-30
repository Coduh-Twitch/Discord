import {
  ApplicationCommandOptionType,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  Message,
  MessageFlags,
  SeparatorSpacingSize,
  userMention,
} from "discord.js";
import { client } from "..";
import { Command, CommandCategory } from "../classes/Command";
import config from "../config";
import { appEmoji } from "../utils/emojiUtils";
import { userModel } from "../models/user";
import { IntermediateUserRemovalError } from "@twurple/auth";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import interactionCreate from "../events/interactionCreate";
import { parseCustomId } from "../utils/customIdUtils";

enum Cards {
  TWO,
  THREE,
  FOUR,
  FIVE,
  SIX,
  SEVEN,
  EIGHT,
  NINE,
  TEN,
  KING,
  JACK,
  QUEEN,
  ACE,
}

enum GameResult {
  WIN,
  LOSS,
  LOSS_EASY,
  DRAW,
  NONE,
}

const GameResultMessages = {
  [GameResult.WIN]: `{user} won this one! {user} won {points} ${config.point_name(true, true)}{plural}!`,
  [GameResult.LOSS]: `{opponent} won this one! {user} lost {points} ${config.point_name(true, true)}{plural}`,
  [GameResult.LOSS_EASY]: `Everyone loses! {user} got to keep {points} ${config.point_name(true, true)}{plural}!`,
  [GameResult.DRAW]: `Nobody Won?! {user} didn't lose any ${config.point_name(true, true)}{plural}!`,
  [GameResult.NONE]: "",
};

const CardValues = {
  [Cards.TWO]: [2],
  [Cards.THREE]: [3],
  [Cards.FOUR]: [4],
  [Cards.FIVE]: [5],
  [Cards.SIX]: [6],
  [Cards.SEVEN]: [7],
  [Cards.EIGHT]: [8],
  [Cards.NINE]: [9],
  [Cards.TEN]: [10],
  [Cards.JACK]: [10],
  [Cards.QUEEN]: [10],
  [Cards.KING]: [10],
  [Cards.ACE]: [1, 11],
};

const CardNames = {
  [Cards.TWO]: "Two",
  [Cards.THREE]: "Three",
  [Cards.FOUR]: "Four",
  [Cards.FIVE]: "Five",
  [Cards.SIX]: "Six",
  [Cards.SEVEN]: "Seven",
  [Cards.EIGHT]: "Eight",
  [Cards.NINE]: "Nine",
  [Cards.TEN]: "Ten",
  [Cards.JACK]: "Jack",
  [Cards.QUEEN]: "Queen",
  [Cards.KING]: "King",
  [Cards.ACE]: "Ace",
};

const CardLetters = {
  [Cards.TWO]: "2",
  [Cards.THREE]: "3",
  [Cards.FOUR]: "4",
  [Cards.FIVE]: "5",
  [Cards.SIX]: "6",
  [Cards.SEVEN]: "7",
  [Cards.EIGHT]: "8",
  [Cards.NINE]: "9",
  [Cards.TEN]: "10",
  [Cards.JACK]: "J",
  [Cards.QUEEN]: "Q",
  [Cards.KING]: "K",
  [Cards.ACE]: "A",
};

enum Plays {
  HIT,
  STAND,
}

enum RoundResult {
  BUST,
  GOOD,
  WIN,
}

interface Round {
  index: number;
  card: Cards;
  card_value: number;
}

interface Game {
  player_id: string;
  started_at: number;
  player_total: number;
  dealer_total: number;
  player_hand: Cards[];
  dealer_hand: Cards[];
  interacted: boolean;
  result: GameResult;
  deck: Cards[];
  wager: number;
  surrendered: boolean;
}

const players: Set<string> = new Set();
const cardSymbol = "🃏";
const playerSymbol = "♥️";
const dealerSymbol = "♦️";
const maxScore = 21;

function total(hand: Cards[]): number {
  hand = hand.sort((a, b) => a - b);
  let tot = 0;

  for (const card of hand) {
    const values: number[] = CardValues[card].sort((a, b) => b - a);
    let definiteValue = values.length === 1;
    if (definiteValue) {
      tot += values[0];
    } else {
      if (tot + values[0] > maxScore && !(tot + values[1] > maxScore)) {
        tot += values[1];
      } else {
        let max = Math.max(tot + values[0], tot + values[1]);
        let min = Math.min(tot + values[0], tot + values[1]);

        if (max > 21) {
          tot = min;
        } else tot = max;
      }
    }
  }

  return tot;
}

function result(hand: Cards[]): RoundResult {
  let tot = total(hand);
  return tot === 21
    ? RoundResult.WIN
    : tot > 21
      ? RoundResult.BUST
      : RoundResult.GOOD;
}

async function distributePoints(
  game: Game,
  msg: Message | null = null,
): Promise<void> {
  console.log("POINT DISTRIBUTION", game.wager);
  if (game.wager > 0) {
    const dbUser = await userModel.findOne({ id: game.player_id });
    let wager = game.wager;
    let delta = "+";
    let amount = game.wager;

    if (game.result === GameResult.WIN) {
      if (!msg) dbUser.set("points", dbUser.points + wager);
    }
    if (game.result === GameResult.LOSS_EASY) {
      delta = "-";
      amount = Math.round(wager / 2);
      if (!msg) dbUser.set("points", dbUser.points - amount);
    }
    if (game.result === GameResult.LOSS) {
      delta = "-";
      amount = wager;
      if (!msg) dbUser.set("points", amount);
    }

    if (msg) {
      try {
        let user = await client.users.fetch(game.player_id);
        msg.reply({
          content: `[DEBUG] ${game.result === GameResult.DRAW ? `The game was a draw, no points would've been awarded.` : `${delta}${amount.toLocaleString()} would have been ${delta === "+" ? "awarded to" : "taken from"} **${user.displayName}**`}\n-# This message will disappear when Blackjack is out of beta.`,
        });
      } catch (e) {}
    }

    if (!msg) await dbUser.save();
    players.delete(game.player_id);
  }
}

async function buildGameContainer(game: Game): Promise<TMComponentBuilder> {
  const container = new TMComponentBuilder();
  if (game) {
    let points = game.wager;
    if (game.result === GameResult.LOSS_EASY) points = Math.round(points / 2);
    let resultMessage = GameResultMessages[game.result]
      .replaceAll("{user}", `${userMention(game.player_id)}`)
      .replaceAll("{opponent}", `${userMention(client.user.id)}`)
      .replaceAll("{points}", points.toLocaleString())
      .replaceAll("{plural}", points === 1 ? "" : "s");
    if (game.wager <= 0)
      resultMessage = `${resultMessage.split("! ")[0].trim()}!`;
    container
      .addTextDisplay(
        `-# ${cardSymbol} ${userMention(game.player_id)}'s Blackjack **[BETA]** Game${game.wager > 0 ? ` • ${game.wager.toLocaleString()} ${config.point_name(false, true)}s` : ""} • Started <t:${Math.floor(game.started_at / 1000)}:R>`,
      )
      .addSeparator();

    container.addTextDisplay(
      `### ${userMention(game.player_id)} ${playerSymbol} __${game.player_total}__ | __${game.dealer_total}__ ${dealerSymbol} ${userMention(client.user.id)}`,
    );
    container.addSeparator(SeparatorSpacingSize.Small);
    container.addTextDisplay(
      `-# - ${userMention(game.player_id)}'s Hand > ${game.player_hand.map((c) => `**${CardLetters[c]}**`).join(", ")}\n-# - ${userMention(client.user.id)}'s Hand > ${game.dealer_hand.map((c) => `**${CardLetters[c]}**`).join(", ")}`,
    );

    if (game.result === GameResult.NONE && !game.surrendered) {
      // if (!game.interacted)
      //   container.addTextDisplay(
      //     `-# Waiting for ${userMention(game.player_id)}...`,
      //   );

      container.addSeparator();
      container.addTextDisplay(`### Click to Play`);
      container.addButtonActionRow([
        TMComponentBuilder.accessoryButton(
          ButtonStyle.Primary,
          "Hit",
          null,
          null,
          { interactionId: game.player_id, action: "bj-hit" },
        ),
        TMComponentBuilder.accessoryButton(
          game.player_hand.length === 1
            ? ButtonStyle.Secondary
            : ButtonStyle.Primary,
          "Stand",
          null,
          null,
          { interactionId: game.player_id, action: "bj-stand" },
        ).setDisabled(game.player_hand.length === 1),
        TMComponentBuilder.accessoryButton(
          game.player_hand.length === 1
            ? ButtonStyle.Secondary
            : ButtonStyle.Danger,
          "Surrender (End Game)",
          null,
          null,
          { interactionId: game.player_id, action: "bj-surrender" },
        ).setDisabled(game.player_hand.length > 2),
      ]);
      container.addSeparator();
      container.addTextDisplay(`-# ${cardSymbol} **${game.deck.length}**`);
    } else if (!game.surrendered) {
      container.addSeparator();
      container.addTextDisplay(resultMessage);
    } else {
      container.addSeparator();
      container.addTextDisplay(
        `No Contest! ${userMention(game.player_id)} surrendered the game${game.wager > 0 ? `, and didn't lose any ${config.point_name(true, true)}s.` : "."}`,
      );
    }
  } else {
    container.addTextDisplay(`-# ${cardSymbol} Shuffling the deck...`);
  }

  container.addSeparator();
  container.addTextDisplay(
    `-# Blackjack is currently in beta. Please report any bugs to **ducky**. **${config.point_name(false, true)} wagers are for simulation purposes only during the beta. __You will not lose or win any points, bets are randomized.__**`,
  );

  return container;
}

function shuffleDeck<T = Cards>(array: T[]) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(exclusions = {}): Cards[] {
  let cards = Object.values(Cards).filter((t) => typeof t !== "string");
  let cardPerDeck = 4;

  let deck: Cards[] = [];

  for (const card of cards) {
    let toExclude = exclusions[card] || 0;
    let excluded = 0;

    for (var i = 0; i < cardPerDeck; i++) {
      if (toExclude > 0) {
        if (excluded < toExclude) {
          excluded += 1;
        } else deck.push(card);
      } else deck.push(card);
    }
  }

  deck = shuffleDeck<Cards>(deck);

  console.log("BUILT DECK OF LENGTH", deck.length);

  return deck;
}

function drawCard(deck: Cards[]): { card: Cards; newDeck: Cards[] } {
  deck = shuffleDeck(deck);
  const card = deck.shift();
  deck = shuffleDeck(deck);
  const newDeck = deck;

  return { card, newDeck };
}

const BlackjackCommand: Command = {
  enabled: true,
  name: "blackjack",
  description: "Play Blackjack!",
  category: CommandCategory.ECONOMY,
  options: [
    // {
    //   name: "wager-amount",
    //   description: `Would you like to put up ${config.point_name(true, true)}s for this game?`,
    //   type: ApplicationCommandOptionType.Integer,
    //   minValue: 2,
    //   required: false,
    // },
  ],
  run: async (interaction) => {
    if (players.has(interaction.user.id))
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `${await appEmoji(client, "nono")} You are already in a Blackjack game!`,
      });
    // interaction.options.getInteger("wager-amount", false) ||
    let wager = 0;
    const dbUser = await userModel.findOne({ id: interaction.user.id });
    const userPoints = dbUser?.points || 0;

    if (wager > 0 && wager > userPoints)
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `${await appEmoji(client, "nono")} You do not have enough points for that wager!`,
      });
    if (wager > 10000)
      return interaction.reply({
        flags: [MessageFlags.Ephemeral],
        content: `${await appEmoji(client, "nono")} The maximum bet for Blackjack is 10,000 ${config.point_name(true, true)}s`,
      });

    wager = Math.round(Math.random() * 3000);

    let deck = buildDeck();
    let { card: playerStartingCard1, newDeck } = drawCard(deck);
    let { card: playerStartingCard2, newDeck: nd1 } = drawCard(newDeck);
    let { card: dealerStartingCard1, newDeck: nd2 } = drawCard(nd1);
    let { card: dealerStartingCard2, newDeck: finalDeck } = drawCard(nd2);

    let playerStartingHand = [playerStartingCard1, playerStartingCard2];
    let dealerStartingHand = [dealerStartingCard1, dealerStartingCard2];

    for (var i = 0; i < 5; i++) {
      finalDeck = shuffleDeck(finalDeck);
    }

    const res = await interaction.reply({
      components: [(await buildGameContainer(null)).buildContainer()],
      flags: [MessageFlags.IsComponentsV2],
      withResponse: true,
    });

    let game: Game = {
      player_id: interaction.user.id,
      player_total: total(playerStartingHand),
      dealer_total: total(dealerStartingHand),
      player_hand: playerStartingHand,
      dealer_hand: dealerStartingHand,
      started_at: Date.now(),
      interacted: false,
      result: GameResult.NONE,
      deck: finalDeck,
      surrendered: false,
      wager,
    };

    players.add(game.player_id);

    const playerTotal = total(game.player_hand);
    const dealerTotal = total(game.dealer_hand);

    if (playerTotal >= 21 || dealerTotal >= 21) {
      if (playerTotal > 21) {
        game.result = GameResult.LOSS;
      } else if (dealerTotal > 21) {
        game.result = GameResult.WIN;
      } else if (playerTotal === dealerTotal) {
        game.result = GameResult.DRAW;
      } else if (playerTotal > dealerTotal) {
        game.result = GameResult.WIN;
      } else if (dealerTotal > playerTotal) {
        game.result = GameResult.LOSS;
      }
    } else game.result = GameResult.NONE;

    if (game.result !== GameResult.NONE) {
      players.delete(game.player_id);
      await distributePoints(game, res.resource.message);
    }

    setTimeout(async () => {
      const container = await buildGameContainer(game);
      await interaction.editReply({
        flags: [MessageFlags.IsComponentsV2],
        components: [container.buildContainer()],
      });
    }, 1200);

    const collector = res.resource.message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (button) => {
      await button.deferUpdate();
      const customId = parseCustomId(button.customId);

      if (customId.action.includes("hit")) {
        const { card: playerDraw, newDeck: nd1 } = drawCard(game.deck);
        game.deck = nd1;
        // const { card: dealerDraw, newDeck: nd2 } = drawCard(game.deck);
        // game.deck = nd2;

        game.player_hand.push(playerDraw);
        game.player_total = total(game.player_hand);

        // game.dealer_hand.push(dealerDraw);
        // game.dealer_total = total(game.dealer_hand);

        const playerTotal = total(game.player_hand);
        const dealerTotal = total(game.dealer_hand);

        if (playerTotal >= 21 || dealerTotal >= 21) {
          if (playerTotal > 21) {
            game.result = GameResult.LOSS;
          } else if (dealerTotal > 21) {
            game.result = GameResult.WIN;
          } else if (playerTotal === dealerTotal) {
            game.result = GameResult.DRAW;
          } else if (playerTotal > dealerTotal) {
            game.result = GameResult.WIN;
          } else if (dealerTotal > playerTotal) {
            game.result = GameResult.LOSS;
          }
        } else game.result = GameResult.NONE;

        if (game.result !== GameResult.NONE) {
          players.delete(game.player_id);
          await distributePoints(game, res.resource.message);
        }

        const container = await buildGameContainer(game);

        await res.resource.message.edit({
          components: [container.buildContainer()],
        });
      } else if (customId.action.includes("stand")) {
        // const { card: playerDraw, newDeck: nd1 } = drawCard(game.deck);
        // game.deck = nd1;
        while (total(game.dealer_hand) < 17) {
          const { card: dealerDraw, newDeck: nd2 } = drawCard(game.deck);
          game.deck = nd2;

          game.dealer_hand.push(dealerDraw);
          game.dealer_total = total(game.dealer_hand);
        }

        const playerTotal = total(game.player_hand);
        const dealerTotal = total(game.dealer_hand);

        if (playerTotal > 21) {
          game.result = GameResult.LOSS; // player busts
        } else if (dealerTotal > 21) {
          game.result = GameResult.WIN; // dealer busts
        } else if (playerTotal === dealerTotal) {
          game.result = GameResult.DRAW; // push (tie)
        } else if (playerTotal > dealerTotal) {
          game.result = GameResult.WIN; // higher total
        } else {
          game.result = GameResult.LOSS; // dealer higher total
        }

        if ((game.result as any as GameResult) !== GameResult.NONE) {
          players.delete(game.player_id);
          await distributePoints(game, res.resource.message);
        }

        const container = await buildGameContainer(game);

        await res.resource.message.edit({
          components: [container.buildContainer()],
        });
      } else if (customId.action.includes("surrender")) {
        game.surrendered = true;
        const container = await buildGameContainer(game);

        await res.resource.message.edit({
          components: [container.buildContainer()],
        });
      }
    });
  },
};

export default BlackjackCommand;
