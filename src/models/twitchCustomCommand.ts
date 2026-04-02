import { model, Schema } from "mongoose";

export interface CustomCommand {
    id: string; // UUID
    trigger: string; // !something
    content: string; // response content
}

const data = new Schema<CustomCommand>({
    id: String,
    trigger: String,
    content: String
})

export const twitchCustomCommandModel = model("customCommand", data)