import { model, Schema } from "mongoose";

export interface DBUser {
    id: string;
    xp: number;
    level: number;
    lastMessageTimestamp: number;
    shownWelcomeMessage: boolean;
    deletion_flag?: number;
    favorite_movies: string[];
}

const data = new Schema<DBUser>({
    id: String,
    xp: Number,
    level: Number,
    lastMessageTimestamp: Number,
    shownWelcomeMessage: Boolean,
    deletion_flag: Number,
    favorite_movies: []
})

export const userModel = model("discordUser", data)