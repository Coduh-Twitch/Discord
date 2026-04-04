import { ApplicationCommandChoicesData, ApplicationCommandChoicesOption, ApplicationCommandOptionChoiceData, ApplicationCommandOptionType, AutocompleteInteraction, blockQuote, ChatInputCommandInteraction, codeBlock, MessageFlags, PermissionFlagsBits, SeparatorSpacingSize } from "discord.js";
import { Command } from "../classes/Command";
import axios from "axios";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { writeJSON, writeJSONSync } from "fs-extra";
import { join } from "path";

export interface TMDBGenre {
    id: number;
    name: string;
}

export interface TMDBProductionCompany {
    id: number;
    logo_path: string;
    name: string;
    origin_country: string;
}

export interface TMDBProductionCountry {
    iso_3166_1: string;
    name: string;
}

export interface TMDBSpokenLanguage {
    english_name: string;
    iso_639_1: string;
    name: string;
}

export interface TMDBCollection {
    id: number;
    name: string;
    poster_path: string;
    backdrop_path: string;
}

export interface TMDBMovieFull {
    adult: boolean;
    backdrop_path: string;
    belongs_to_collection: TMDBCollection;
    budget: number;
    genres: TMDBGenre[];
    homepage: string;
    id: number;
    imdb_id: string;
    origin_country: string[];
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string;
    production_companies: TMDBProductionCompany[];
    production_countries: TMDBProductionCountry[];
    release_date: string;
    revenue: number;
    runtime: number;
    spoken_languages: TMDBSpokenLanguage[];
    status: string;
    tagline: string;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
}

export interface TMDBCastMember {
    adult: string;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string;
    cast_id: number;
    character: string;
    credit_id: string;
    order: number;
}

export interface TMDBCrewMember {
    adult: string;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string;
    credit_id: string;
    department: string;
    job: string;
}

export interface TMDBCreditFull {
    credit_type: string;
    department: string;
    job: string;
    media: {
        adult: boolean;
        backdrop_path: string;
        id: number;
        name: string;
        original_language: string;
        original_name: string;
        overview: string;
        poster_path: string;
        media_type: string;
        genre_ids: number[];
        popularity: number;
        first_air_date: string;
        vote_average: number;
        vote_count: number;
        origin_country: string[];
        character: string;
        episodes: any[];
        seasons: {
            air_date: string;
            episode_count: number;
            id: number;
            name: string;
            overview: string;
            poster_path: string;
            season_number: number;
            show_id: number;
        }[];
    };
    media_type: string;
    id: string;
    person: {
        adult: boolean;
        id: number;
        name: string;
        original_name: string;
        media_type: string;
        popularity: number;
        gender: number;
        known_for_department: string;
        profile_path: string;
    };
}

async function getMovieById(movieId: string): Promise<TMDBMovieFull | null> {
    let res = await axios.get(`${process.env.TMDB_API_URL}/movie/${movieId}`, { headers: { "Authorization": `Bearer ${process.env.TMDB_TOKEN}` } });
    return res.data || null;
}

async function getCrewByMovieId(movieId: string): Promise<TMDBCrewMember[]> {
    let res = await axios.get(`${process.env.TMDB_API_URL}/movie/${movieId}/credits`, { headers: { "Authorization": `Bearer ${process.env.TMDB_TOKEN}` } });
    return res.data?.crew || [];
}

async function getCreditById(creditId: string): Promise<TMDBCreditFull | null> {
    let res = await axios.get(`${process.env.TMDB_API_URL}/credit/${creditId}`, { headers: { "Authorization": `Bearer ${process.env.TMDB_TOKEN}` } });
    return res.data || null;
}

async function getDirectorsByMovieId(movieId: string): Promise<TMDBCrewMember[]> {
    let crew = await getCrewByMovieId(movieId);
    if(!crew) return [];
    return crew.filter(c => c.job === "Director");
}

const truncate = (input, length: number = 5) => input.length > length ? `${input.substring(0, length)}...` : input;

const MovieCommand: Command = {
    enabled: true,
    name: "movie",
    description: "Manage all movie-related things",
    defaultMemberPermissions: [PermissionFlagsBits.CreateEvents],
    options: [
        {
            name: "search",
            type: ApplicationCommandOptionType.Subcommand,
            description: "Get information about a particular movie",
            options: [
                {
                    name: "query",
                    description: "What you are searching for",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true
                }
            ]
        }
    ],
    autocomplete: async (interaction: AutocompleteInteraction) => {

        let focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === "query") {
            
            let results: ApplicationCommandOptionChoiceData[] = [];
            let MAX = 10;
            let query = focusedOption.value;
            if (!query || query === "") results = [{ name: "Please start typing your search query.", value: "none" }]
            console.log(query);

            let { data: res } = query !== "" ? await axios.get(`${process.env.TMDB_API_URL}/search/movie?query=${encodeURIComponent(query)}&region=us`, { headers: { "Authorization": `Bearer ${process.env.TMDB_TOKEN}` } }) : { data: null };
            console.log("RES", res)
            // let res = await tmdb.get("/search/movie", {query: query});

            if ((!res || !res?.results) && query !== "") results = [{ name: "No results found, please try another query.", value: "none" }];

            if (res?.results) results = [];

            if (res?.results) res.results.forEach(async movie => {

                if (results.length < MAX && (movie?.genre_ids || []).length > 0 && movie.id) results.push({ name: `${truncate(movie?.title, 90) || "No title found"} (${movie?.release_date.split("-")[0] || "0000"})`, value: `${movie.id}` })
            })

            console.log("RESULTS", results);
            results = results.sort((a, b) => a.name.localeCompare(b.name))


            if (results.length > 0) await interaction.respond(results);
        }
    },
    run: async (interaction: ChatInputCommandInteraction) => {
        let subcommand = interaction.options.getSubcommand(true);

        if (subcommand === "search") {
            let movieId = interaction.options.getString('query', true);
            let movie = await getMovieById(movieId);
            if (!movie) return interaction.reply({ flags: [MessageFlags.Ephemeral], content: `Movie ID ${movieId} not found.` });
            let directors = await getDirectorsByMovieId(movie.id.toString())
            console.log("DIRECTORS", directors)


            let movieContainer = new TMComponentBuilder();
            if (movie.backdrop_path) {
                movieContainer.addMediaGallery([{ media: { url: `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` } }])
            }

            if (movie.poster_path) {
                movieContainer.addThumbnailAccessorySection(`# ${movie.title} (${movie.release_date.split("-")[0]})\n-# ${movie.genres.map(g => `${g.name}`).join(", ")} ${movie.adult ? `• **18+**` : ""}\n${movie.production_companies.length > 0 ? `\n-# **Studio${movie.production_companies.length === 1 ? "" : "s"}:** ${movie.production_companies.map(c => `\`${c.name}\``).join(" ")}` : ""}${directors.length > 0 ? `\n-# **Director${directors.length === 1 ? "" : "s"}:** ${directors.map(c => `${c.name}`).join(" ")}` : ""}`, `https://image.tmdb.org/t/p/w780${movie.poster_path}`)
            } else {
                movieContainer.addTextDisplay(`## ${movie.title}\n-# ${movie.release_date.split("-")[0]} • ${movie.genres.map(g => `${g.name}`).join(", ")} ${movie.adult ? `• **18+**` : ""}\n${movie.production_companies.length > 0 ? `\n-# **Studio${movie.production_companies.length === 1 ? "" : "s"}:** ${movie.production_companies.map(c => `\`${c.name}\``).join(" ")}` : ""}${directors.length > 0 ? `\n-# **Director${directors.length === 1 ? "" : "s"}:** ${directors.map(c => `${c.name}`).join(" ")}` : ""}`);
            }
            movieContainer.addSeparator(SeparatorSpacingSize.Small)
            movieContainer.addTextDisplay(`${blockQuote(movie.overview || "No Overview Found")}`)
            movieContainer.addTextDisplay(`\n\n-# [View on TMDB](https://themoviedb.org/movie/${movie.id})`)



            interaction.reply({
                flags: [MessageFlags.IsComponentsV2], components: [movieContainer.buildContainer()
                ]
            })

        }
    }
}

export default MovieCommand;