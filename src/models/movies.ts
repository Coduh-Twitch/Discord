import { model, Schema } from "mongoose";

export interface DBMovieAssociation {
    [formattedString: string]: string; // movieId
}

export interface DBMovie {
    guildId: string;
    movies: DBMovieAssociation;
}

const data = new Schema<DBMovie>({
    guildId: String,
    movies: {
        type: Object,
        default: {}
    }
})

export const movieModel = model("movie", data);