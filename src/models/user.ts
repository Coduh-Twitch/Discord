import { model, Schema } from "mongoose";

export interface DBUser {
    id: string;
    xp: number;
    level: number;
    lastMessageTimestamp: number;
    points: number;
    messages: number;
    shownWelcomeMessage: boolean;
    synced: boolean;
    deletion_flag?: number;
    favorite_movies: string[];
}

const data = new Schema<DBUser>({
    id: String,
    xp: Number,
    points: {
        type: Number,
        default: 0
    },
    messages: {
        type: Number,
        default: 0
    },
    synced: {
        type: Boolean,
        default: false
    },
    level: Number,
    lastMessageTimestamp: Number,
    shownWelcomeMessage: Boolean,
    deletion_flag: Number,
    favorite_movies: []
})

export const userModel = model("discordUser", data)