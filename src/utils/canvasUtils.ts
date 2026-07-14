import {
  Canvas,
  createCanvas,
  CanvasRenderingContext2D,
  Image,
  GlobalFonts,
  SKRSContext2D,
  loadImage,
} from "@napi-rs/canvas";
import {
  AttachmentBuilder,
  GuildMember,
  ImageSize,
  MessageFlags,
} from "discord.js";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { avg } from "..";
import { Question } from "../commands/daily";
import { answers } from "../db/schema";
import { join } from "path";
import { RPS } from "../commands/rps";
import config from "../config";
import { X509Certificate } from "crypto";
import { RefreshingAuthProvider } from "@twurple/auth";
import { start } from "repl";

function roundedImage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function ordinal_suffix_of(i: number) {
  let j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) {
    return i.toLocaleString() + "st";
  }
  if (j === 2 && k !== 12) {
    return i.toLocaleString() + "nd";
  }
  if (j === 3 && k !== 13) {
    return i.toLocaleString() + "rd";
  }
  return i.toLocaleString() + "th";
}

export function memberWelcomeImage(
  m: GuildMember,
): Promise<{ attachment: AttachmentBuilder; url: string } | null> {
  return new Promise((resolve) => {
    const canvas: Canvas = createCanvas(2100, 850);
    const ctx: SKRSContext2D = canvas.getContext("2d");

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-Black.ttf"),
      "Inter Black",
    );

    avg(m.displayAvatarURL(), true).then((memberAvgColor: string) => {
      let strokeColor = "#142E35";

      let borderRadius = 32;
      let w = canvas.width;
      let h = canvas.height;

      ctx.save();
      roundedImage(ctx, 0, 0, w, h, borderRadius);
      ctx.stroke();
      ctx.clip();

      let gradient = ctx.createLinearGradient(w, h, w, h);
      gradient.addColorStop(2, `${memberAvgColor}9b`);
      // gradient.addColorStop(2, `#286E819b`);
      gradient.addColorStop(10, "#19434F9b");

      ctx.fillStyle = "#2F2F2F";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();

      let i = 512;
      let padding = 100;
      let strokeWidth = 10;
      let verticalOffset = h / 2 - (i + strokeWidth) / 2;
      let verticalOffsetFrombottom = verticalOffset + (i + strokeWidth / 2);
      let textHorizonalOffset = padding + i + strokeWidth / 2 + 50;

      ctx.save();
      roundedImage(
        ctx,
        padding - strokeWidth / 2,
        verticalOffset,
        i + strokeWidth,
        i + strokeWidth,
        borderRadius,
      );
      ctx.stroke();
      ctx.clip();
      ctx.fillStyle = strokeColor;
      ctx.fillRect(
        padding - strokeWidth / 2,
        h / 2 - (i + strokeWidth) / 2,
        i + strokeWidth,
        i + strokeWidth,
      );
      ctx.restore();

      let image = new Image();

      image.onload = () => {
        console.log("Image loaded", image);
        ctx.save();
        roundedImage(ctx, padding, h / 2 - i / 2, i, i, borderRadius);
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(image, padding, h / 2 - i / 2, i, i);
        ctx.restore();

        let lineHeight = 90;

        ctx.font = '900 90px "Inter Black"';
        ctx.fillStyle = "#ffffffcc";

        ctx.fillText(
          "Welcome to coduh's crib!",
          textHorizonalOffset,
          verticalOffset + lineHeight,
          1300,
        );

        ctx.font = '600 70px "Inter Black"';
        // ctx.fillStyle = "#78e1fdd7";
        ctx.fillStyle = `${memberAvgColor}`;

        ctx.fillText(
          `@${m.user.username}`,
          textHorizonalOffset,
          verticalOffset + lineHeight * 3,
          1300,
        );

        ctx.font = '900 90px "Inter Black"';
        ctx.fillStyle = "#ffffffcc";
        ctx.fillText(
          `You're the ${ordinal_suffix_of(m.guild.memberCount)} member!`,
          textHorizonalOffset,
          verticalOffsetFrombottom - 20,
          1300,
        );

        let exported = canvas.toBuffer("image/png");
        let attachmentName = `welcome-${m.id}.png`;
        const at = new AttachmentBuilder(exported, { name: attachmentName });
        let attachmentUrl = `attachment://${attachmentName}`;

        resolve({ attachment: at, url: attachmentUrl });
      };

      image.onerror = (err) => {
        resolve(null);
      };

      image.src = m.displayAvatarURL({
        forceStatic: true,
        extension: "png",
        size: 512,
      });
    });
  });
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function lightenHex(hex: string, percent: number) {
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);

  r = Math.round(r + (255 - r) * percent);
  g = Math.round(g + (255 - g) * percent);
  b = Math.round(b + (255 - b) * percent);

  const toHex = (c) => c.toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function wouldYouRatherImage(
  questionNumber: number,
  options: (typeof answers.$inferInsert)[],
  final: boolean = false,
): Promise<{ attachment: AttachmentBuilder; url: string } | null> {
  return new Promise((resolve) => {
    const canvas: Canvas = createCanvas(1920, 1080);
    const ctx: SKRSContext2D = canvas.getContext("2d");

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-Black.ttf"),
      "Inter Black",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "RacersDelight.otf"),
      "Racer",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-SemiBold.ttf"),
      "Inter SemiBold",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "NotoColorEmoji.ttf"),
      "Noto Color Emoji",
    );

    let w = canvas.width;
    let h = canvas.height;

    ctx.save();
    // roundedImage(ctx, 0, 0, w, h, borderRadius);
    // ctx.stroke();
    // ctx.clip();

    // let gradient = ctx.createLinearGradient(w, h, w, h);

    let wywRed = "#D22D39";
    let wywBlue = "#5865f2";

    // Red Half
    ctx.fillStyle = wywRed;
    ctx.fillRect(0, 0, w / 2, h);

    // Blue (new blurple) Half
    ctx.fillStyle = wywBlue;
    ctx.fillRect(w / 2, 0, w / 2, h);

    // Black Separator
    let separatorWidth = 15;
    ctx.fillStyle = "#000000";
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillRect(w / 2 - separatorWidth / 2, 0, separatorWidth, h);

    ctx.restore();

    // // Heading Text
    // ctx.setTransform(1, 0, 0, 1, 0, 0);
    let headingLineHeight = 170;
    // let headingMaxWidth = 1920;
    // let headingYOffset = 190;
    // ctx.font = '160px "Inter Black"';

    // ctx.textAlign = "center";
    // ctx.textBaseline = "alphabetic";
    // ctx.strokeStyle = "black";
    // ctx.lineWidth = 7;
    // ctx.lineJoin = "round";

    // // const headingGradient = ctx.createLinearGradient(0, 0, w, 0);

    // // headingGradient.addColorStop(0, lightenHex("#ff0000", 0.2));
    // // // headingGradient.addColorStop(0.496, lightenHex("#ff0000", 0.8));
    // // // headingGradient.addColorStop(0.497, "black");

    // // // headingGradient.addColorStop(0.503, "black");
    // // // headingGradient.addColorStop(0.504, lightenHex("#0000ff", 0.8));
    // // headingGradient.addColorStop(1, lightenHex("#0000ff", 0.2));

    // ctx.fillStyle = "#fff";

    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // ctx.fillText(
    //   "Would You Rather",
    //   Math.round(w / 2),
    //   headingYOffset,
    //   headingMaxWidth,
    // );
    // ctx.strokeText(
    //   "Would You Rather",
    //   Math.round(w / 2),
    //   headingYOffset,
    //   headingMaxWidth,
    // );

    // Footer Text (watermark)
    let footerMaxWidth = 800;
    let footerYOffset = Math.round(h - 30);
    let footerXOffset = 50;
    ctx.font = '28px "Inter Black"';
    ctx.textAlign = "left";
    // ctx.strokeStyle = "black";
    // ctx.lineWidth = 2;
    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      `coduh's crib | Daily Question #${questionNumber.toLocaleString()}`,
      footerXOffset,
      footerYOffset,
      footerMaxWidth,
    );
    ctx.strokeText(
      `coduh's crib | Daily Question #${questionNumber.toLocaleString()}`,
      footerXOffset,
      footerYOffset,
      footerMaxWidth,
    );

    // Date Footer Text
    footerMaxWidth = 900;
    footerYOffset = h - 30;
    footerXOffset = w - 50;
    ctx.font = '28px "Inter Black"';
    ctx.textAlign = "right";
    // ctx.strokeStyle = "black";
    // ctx.lineWidth = 2;
    ctx.fillStyle = "#ffffff";

    let formatter = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "long",
      timeZone: "America/New_York",
    });

    ctx.fillText(
      `Would You Rather`,
      footerXOffset,
      footerYOffset,
      footerMaxWidth,
    );
    ctx.strokeText(
      `Would You Rather`,
      footerXOffset,
      footerYOffset,
      footerMaxWidth,
    );

    // Option Text
    let optionYOffset = 30;
    let optionFontSize = 120;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";

    // Left
    if (options[0].answer_text.length <= 15) {
      optionFontSize = 150;
      optionYOffset = optionYOffset + 30;
    }
    ctx.font = `${optionFontSize}px "Inter Black"`;
    wrapText(
      ctx,
      options[0].answer_text,
      w / 2 - w / 2 / 2,
      h / 2 + optionYOffset,
      w / 2 - 100,
      headingLineHeight,
    );

    // Right
    if (options[1].answer_text.length <= 15) {
      optionFontSize = 150;
      optionYOffset = optionYOffset + 30;
    }
    ctx.font = `${optionFontSize}px "Inter Black"`;
    wrapText(
      ctx,
      options[1].answer_text,
      w / 2 + w / 4,
      h / 2 + optionYOffset,
      w / 2 - 100,
      headingLineHeight,
    );

    // Vote Text
    let votesYOffset = 200;
    ctx.font = '200px "Inter Black", "Noto Color Emoji"';
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 9;

    // Left
    ctx.fillText(
      `${(options[0].votes || 0) > options[1].votes ? `${final ? "🏆 " : "▲ "}` : ""}${options[0]?.votes.toLocaleString() || 0}`,
      w / 2 - w / 2 / 2,
      h / 2 - votesYOffset,
    );

    ctx.strokeText(
      `${(options[0].votes || 0) > options[1].votes ? `${final ? "🏆 " : "▲ "}` : ""}${options[0]?.votes.toLocaleString() || 0}`,
      w / 2 - w / 2 / 2,
      h / 2 - votesYOffset,
    );

    // Right
    ctx.fillText(
      `${(options[0].votes || 0) < options[1].votes ? `${final ? "🏆 " : "▲ "}` : ""}${options[1]?.votes.toLocaleString() || 0}`,
      w / 2 + w / 4,
      h / 2 - votesYOffset,
    );

    ctx.strokeText(
      `${(options[0].votes || 0) < options[1].votes ? `${final ? "🏆 " : "▲ "}` : ""}${options[1]?.votes.toLocaleString() || 0}`,
      w / 2 + w / 4,
      h / 2 - votesYOffset,
    );

    let exported = canvas.toBuffer("image/png");
    let attachmentName = `wyw-${Date.now()}.png`;
    const at = new AttachmentBuilder(exported, { name: attachmentName });
    let attachmentUrl = `attachment://${attachmentName}`;

    resolve({ attachment: at, url: attachmentUrl });
  });
}

export function rpsHeaderImage(
  game: RPS.Game,
): Promise<{ attachment: AttachmentBuilder; url: string } | null> {
  return new Promise((resolve) => {
    const canvas: Canvas = createCanvas(1920, 1080 / 3);
    const ctx: SKRSContext2D = canvas.getContext("2d");

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-Black.ttf"),
      "Inter Black",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "RacersDelight.otf"),
      "Racer",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-SemiBold.ttf"),
      "Inter SemiBold",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "NotoColorEmoji.ttf"),
      "Noto Color Emoji",
    );

    // game.rounds = game.rounds.filter((r) => r.result !== RPS.RoundResult.TIE);

    let w = canvas.width;
    let h = canvas.height;
    let profileImageSize = 256;
    let padding = 50;
    let backgroundColor = "#256f81";
    let strokeColor = "#1b5260";

    ctx.save();

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Player Profile Icons

    // Player 1 (Left)
    const player_1_image = loadImage(
      game.player_1.displayAvatarURL({
        forceStatic: true,
        extension: "png",
        size: 256,
      }),
    );

    // Player 2 (Right)
    const player_2_image = loadImage(
      game.player_2.displayAvatarURL({
        forceStatic: true,
        extension: "png",
        size: 256,
      }),
    );
    player_1_image.then((loadedImage) => {
      player_2_image.then((loadedImage2) => {
        // Left (Player 1)
        ctx.save();
        ctx.strokeStyle = strokeColor;

        if (!game.plays.player_1) ctx.filter = "grayscale(100%)";

        roundedImage(
          ctx,
          padding,
          h / 2 - profileImageSize / 2,
          profileImageSize,
          profileImageSize,
          profileImageSize / 2, // Radius
        ); // Left (Player 1)
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(
          loadedImage,
          padding,
          h / 2 - profileImageSize / 2,
          profileImageSize,
          profileImageSize,
        ); // Left (Player 1)
        ctx.restore();

        // Right (Player 2)
        ctx.save();
        ctx.strokeStyle = strokeColor;

        if (!game.plays.player_2) ctx.filter = "grayscale(100%)";

        roundedImage(
          ctx,
          w - padding - profileImageSize,
          h / 2 - profileImageSize / 2,
          profileImageSize,
          profileImageSize,
          profileImageSize / 2, // Radius
        ); // Right (Player 2)
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(
          loadedImage2,
          w - padding - profileImageSize,
          h / 2 - profileImageSize / 2,
          profileImageSize,
          profileImageSize,
        ); // Right (Player 2)
        ctx.restore();

        // Middle Line
        let lineWidth = 10;
        let lineHeight = h / 1.25;
        ctx.fillStyle = strokeColor;
        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.roundRect(
          w / 2 - lineWidth / 2,
          h / 2 - lineHeight / 2,
          lineWidth,
          lineHeight,
          10,
        );
        ctx.stroke();
        ctx.fill();
        ctx.restore();

        // Moves Text
        let moveYOffset = 25;
        ctx.font = '128px "Inter Black", "Noto Color Emoji"';
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.lineWidth = 9;

        let player_1_icons = game.rounds
          .slice(-3)
          .map((r) => `${RPS.Icons[r.player_1_choice]}`)
          .join(" ");

        let player_2_icons = game.rounds
          .slice(-3)
          .map((r) => `${RPS.Icons[r.player_2_choice]}`)
          .reverse()
          .join(" ");

        // Left Moves (Player 1)
        ctx.textAlign = "left";
        ctx.fillText(
          player_1_icons,
          profileImageSize + padding * 2,
          h / 2 + moveYOffset,
        );

        // Right Moves (Player 2)
        ctx.textAlign = "right";
        ctx.fillText(
          player_2_icons,
          w - (profileImageSize + padding * 2),
          h / 2 + moveYOffset,
        );

        ctx.font = '64px "Inter Black", "Noto Color Emoji"';
        ctx.textAlign = "center";
        ctx.fillStyle = strokeColor;
        ctx.lineWidth = 9;

        // let i = 0;
        let startIndex = Math.max(0, game.rounds.length - 3);

        let ii = 0;
        for (var index = startIndex; index < game.rounds.length; index++) {
          let i = index + 1;
          ii += 1;

          // Left Round Labels
          ctx.textAlign = "left";
          ctx.fillText(
            `R${i}`,
            profileImageSize + (padding / 2) * 3 * (ii * 2.5) - padding / 2,
            h / 2 + moveYOffset + 100,
          );

          // Right Round Labels
          ctx.textAlign = "right";
          ctx.fillText(
            `R${i}`,
            w -
              (profileImageSize + (padding / 2) * 3 * (ii * 2.2) - padding / 2),
            h / 2 + moveYOffset + 100,
          );
        }

        let exported = canvas.toBuffer("image/png");
        let attachmentName = `rps-heading-${Date.now()}.png`;
        const at = new AttachmentBuilder(exported, { name: attachmentName });
        let attachmentUrl = `attachment://${attachmentName}`;

        resolve({ attachment: at, url: attachmentUrl });
      });
    });
  });
}

export function rpsWinnerImage(
  game: RPS.Game,
): Promise<{ attachment: AttachmentBuilder; url: string } | null> {
  return new Promise((resolve) => {
    const canvas: Canvas = createCanvas(1920, 720);
    const ctx: SKRSContext2D = canvas.getContext("2d");

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-Black.ttf"),
      "Inter Black",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "RacersDelight.otf"),
      "Racer",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "Inter-SemiBold.ttf"),
      "Inter SemiBold",
    );

    GlobalFonts.registerFromPath(
      join(process.cwd(), "src", "fonts", "NotoColorEmoji.ttf"),
      "Noto Color Emoji",
    );

    let w = canvas.width;
    let h = canvas.height;
    let profileImageSize = 300;
    let requestedImageSize: ImageSize = 512;
    let padding = 50;
    let backgroundColor = "#256f81";
    let strokeColor = "#1b5260";

    ctx.save();

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Player Profile Icons

    // Player 1 (Left)
    const player_1_image = loadImage(
      game.player_1.displayAvatarURL({
        forceStatic: true,
        extension: "png",
        size: requestedImageSize,
      }),
    );

    // Player 2 (Right)
    const player_2_image = loadImage(
      game.player_2.displayAvatarURL({
        forceStatic: true,
        extension: "png",
        size: requestedImageSize,
      }),
    );
    player_1_image.then((loadedImage) => {
      player_2_image.then((loadedImage2) => {
        let winnerImage = loadedImage;
        let loserImage = loadedImage2;

        let imageX = w / 2 - profileImageSize / 2;
        let imageY = padding;

        if (game.winner === game.player_2) {
          winnerImage = loadedImage2;
          loserImage = loadedImage;
        }

        ctx.save();
        ctx.strokeStyle = strokeColor;

        roundedImage(
          ctx,
          imageX,
          imageY,
          profileImageSize,
          profileImageSize,
          profileImageSize / 2, // Radius
        ); // Left (Player 1)
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(
          winnerImage,
          imageX,
          imageY,
          profileImageSize,
          profileImageSize,
        );
        ctx.restore();

        ctx.font = '100px "Inter Black", "Noto Color Emoji"';
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";

        ctx.fillText("🏆 Winner!", w / 2, padding * 4 + profileImageSize);

        ctx.font = '84px "Inter SemiBold", "Noto Color Emoji"';
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";

        ctx.fillText(game.winner.displayName, w / 2, h - padding * 1.5);

        if (game.wager && game.wager > 0) {
          ctx.save();
          ctx.font = '84px "Inter Black", "Noto Color Emoji"';
          ctx.textAlign = "left";

          let pointString = `${game.wager.toLocaleString()}${config.emojis.points}`;

          ctx.fillText(
            `+${pointString}`,
            imageX + padding * 3.5 + profileImageSize / 2,
            imageY + profileImageSize / 2 + 33,
          );
          ctx.restore();

          // Small Loser Display (Minus Points)
          ctx.save();
          ctx.strokeStyle = strokeColor;

          let smallImageSize = profileImageSize / 2;
          let smallImageY = imageY + profileImageSize / 2 - smallImageSize / 2;

          roundedImage(
            ctx,
            padding,
            smallImageY,
            smallImageSize,
            smallImageSize,
            smallImageSize / 2, // Radius
          );
          ctx.stroke();
          ctx.clip();
          ctx.filter = "grayscale(100%)";
          ctx.drawImage(
            loserImage,
            padding,
            smallImageY,
            smallImageSize,
            smallImageSize,
          );
          ctx.restore();

          ctx.font = '56px "Racer", "Inter Black", "Noto Color Emoji"';
          ctx.textAlign = "left";
          ctx.fillStyle = strokeColor;

          ctx.fillText(
            `-${pointString.replace(config.emojis.points, "").trim()}`,
            padding * 1.5 + smallImageSize,
            smallImageY + smallImageSize / 2 + 25,
          );
        }

        let exported = canvas.toBuffer("image/png");
        let attachmentName = `rps-game-${Date.now()}.png`;
        const at = new AttachmentBuilder(exported, { name: attachmentName });
        let attachmentUrl = `attachment://${attachmentName}`;
        resolve({ attachment: at, url: attachmentUrl });
      });
    });
  });
}
