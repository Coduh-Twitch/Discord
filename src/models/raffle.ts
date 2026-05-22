import { model, Schema } from "mongoose";

export interface DBRaffleParticipant {
	id: string;
	raffle_id: string;
}

export interface DBRaffle {
	id: string;
	creator_id: string;
	channel_id: string;
	expires_at: number;
	points: number;
	winner_id: string;
	participants: DBRaffleParticipant[];
}

const data = new Schema<DBRaffle>({
    id: String,
	channel_id: String,
    points: {
        type: Number,
        default: 1000
    },
    creator_id: String,
	expires_at: Number,
	winner_id: String,
	participants: []
})

export const raffleModel = model("raffle", data)