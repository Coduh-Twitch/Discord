import { model, Schema } from "mongoose";

export interface PollOption {
    id: string;
    text: string;
    votes: number;
}

export interface PollOptions {
    [id: string]: PollOption;
}

export interface Poll {
    id: string;
    title: string;
    options: PollOptions;
    messageId: string;
}

const data = new Schema<Poll>({
    id: String,
    title: String,
    messageId: String,
    options: {}
})

export const pollModel = model("poll", data)