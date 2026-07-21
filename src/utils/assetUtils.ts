import { AttachmentBuilder } from "discord.js";
import { join } from "path";
import { Rank } from "../classes/Lounge";

export const loadAsset = (file: string): AttachmentBuilder => {
  return new AttachmentBuilder(
    join(process.cwd(), "src", "assets", file),
  ).setName(file);
};

export const loadLoungeIcon = (rank: Rank): AttachmentBuilder => {
  return new AttachmentBuilder(
    join(process.cwd(), "src", "assets", "lounge", `${rank.toLowerCase()}.png`),
  ).setName(`${rank}.png`);
};
