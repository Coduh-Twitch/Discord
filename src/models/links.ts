import { model, Schema } from "mongoose";

export interface AccountLink {
    discordId: string;
    twitchId: string;
    startTimestamp: number;
    reminded: boolean;
    linked: boolean;
}

const data = new Schema<AccountLink>({
    discordId: String,
    twitchId: String,
    startTimestamp: Number,
    reminded: Boolean,
    linked: Boolean
})

export const linkModel = model("links", data);