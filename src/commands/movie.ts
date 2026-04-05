import { ApplicationCommandChoicesData, ApplicationCommandChoicesOption, ApplicationCommandOptionChoiceData, ApplicationCommandOptionType, AutocompleteInteraction, blockQuote, channelMention, ChannelType, ChatInputCommandInteraction, codeBlock, ComponentType, ContainerBuilder, Events, MessageFlags, PermissionFlagsBits, Poll, PollData, PollLayoutType, roleMention, SeparatorSpacingSize, TextChannel, User, userMention } from "discord.js";
import { Command } from "../classes/Command";
import axios from "axios";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { writeJSON, writeJSONSync } from "fs-extra";
import { join } from "path";
import config from "../config";
import { movieModel } from "../models/movies";

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

const truncate = (input, length: number = 5) => input.length > length ? `${input.substring(0, length)}...` : input;

function formatMovieString(movie: Partial<TMDBMovieFull>, pretty: boolean = true, trunc: boolean = false, length: number = 50): string {
    if (!movie.title) movie.title = "No Title Found"
    if (trunc) movie.title = truncate(movie.title, length)
    if (!movie.release_date) movie.release_date = "0000-00-00"
    return `${pretty ? movie.title : movie.title.replaceAll(".", "-")} (${movie.release_date.split("-")[0]})`
}

export async function getMovieById(movieId: string, guildId: string): Promise<TMDBMovieFull | null> {
    let res = await axios.get(`${process.env.TMDB_API_URL}/movie/${movieId}`, { headers: { "Authorization": `Bearer ${process.env.TMDB_TOKEN}` } });
    if (res.data && res.data?.id) {
        let movie = res.data as TMDBMovieFull;
        let formattedString: string = formatMovieString(movie, false);
        let dbMovies = await movieModel.findOne({ guildId: guildId })
        if (!dbMovies) {
            let newMoviesModel = new movieModel({
                guildId,
                movies: {
                    [`${formattedString}`]: movie.id.toString()
                }
            })

            await newMoviesModel.save()

            dbMovies = await movieModel.findOne({ guildId: guildId });
        }

        if (!dbMovies.get(`movies.${formattedString}`)) {
            dbMovies.set(`movies.${formattedString}`, movie.id.toString());

            await dbMovies.save();
        }

    }
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
    if (!crew) return [];
    return crew.filter(c => c.job === "Director");
}


export async function buildMovieContainer(movie: TMDBMovieFull, withImages: boolean = true): Promise<TMComponentBuilder> {
    let directors = await getDirectorsByMovieId(movie.id.toString())

    let movieContainer = new TMComponentBuilder();
    if (movie.backdrop_path && withImages) {
        movieContainer.addMediaGallery([{ media: { url: `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` } }])
    }

    if (movie.poster_path) {
        movieContainer.addThumbnailAccessorySection(`# ${formatMovieString(movie, true)}\n-# ${movie.genres.map(g => `${g.name}`).join(", ")} ${movie.adult ? `• **18+**` : ""}\n${movie.production_companies.length > 0 ? `\n-# **Studio${movie.production_companies.length === 1 ? "" : "s"}:** ${movie.production_companies.map(c => `\`${c.name}\``).join(" ")}` : ""}${directors.length > 0 ? `\n-# **Director${directors.length === 1 ? "" : "s"}:** ${directors.map(c => `${c.name}`).join(" ")}` : ""}`, `https://image.tmdb.org/t/p/w780${movie.poster_path}`)
    } else {
        movieContainer.addTextDisplay(`# ${formatMovieString(movie, true)}\n-# ${movie.genres.map(g => `${g.name}`).join(", ")} ${movie.adult ? `• **18+**` : ""}\n${movie.production_companies.length > 0 ? `\n-# **Studio${movie.production_companies.length === 1 ? "" : "s"}:** ${movie.production_companies.map(c => `\`${c.name}\``).join(" ")}` : ""}${directors.length > 0 ? `\n-# **Director${directors.length === 1 ? "" : "s"}:** ${directors.map(c => `${c.name}`).join(" ")}` : ""}`);
    }
    movieContainer.addSeparator(SeparatorSpacingSize.Small)
    movieContainer.addTextDisplay(`${blockQuote(movie.overview || "No Overview Found")}`)
    movieContainer.addTextDisplay(`\n\n-# [View on TMDB](https://themoviedb.org/movie/${movie.id})`)

    return movieContainer;
}

export async function sendMoviePoll(interaction: ChatInputCommandInteraction | null, user: User, guildId: string, channel: TextChannel, movieIds: string[], multiselect: boolean = false, duration: 1 | 4 | 8 | 24 | 72 = 24) {
    let movies: TMDBMovieFull[] = [];


    let mvPromises = Promise.all(movieIds.filter(v => v !== null).map(async v => {
        if (v) {
            let movie = await getMovieById(v, guildId);
            if (movie && movie.title) return movie;
        }
    }))

    movies = await mvPromises;

    let promises = Promise.all(Object.values(movieIds).map(async v => {
        if (v) {
            let movie = await getMovieById(v, guildId);
            if (movie) return { text: `${formatMovieString(movie, true, true, 45)}` }
        }
    }))

    let poll: PollData = {
        question: {
            text: `Movie Poll (${movies.length} choices)`
        },
        allowMultiselect: multiselect,
        duration,
        layoutType: PollLayoutType.Default,
        answers: []
    }

    poll.answers = await promises;
    poll.answers = poll.answers.filter(a => a !== null && a !== undefined);

    console.log("ANSWERS", poll.answers)

    // let channel = interaction.options.getChannel("channel", true) as TextChannel;

    let replaceMsg = await channel.send({ content: "### Creating Poll..." })

    let sent = 0;
    let polled = false;
    let containers = [];

    let pr = Promise.all(movies.map(async movie => {
        console.log("PR", movie.title)
        let container = await buildMovieContainer(movie, false);
        return container.buildContainer();
    }))

    containers = await pr;

    // movieId, messageUrl
    let sentContainers: Record<string, string> = {};

    containers.forEach((c, i) => {
        channel.send({ components: [c], flags: [MessageFlags.IsComponentsV2] }).then(m => {
            sent += 1;
            sentContainers[movies[i].id.toString()] = m.url;
        })
    })

    setInterval(() => {
        if (sent === poll.answers.length && !polled) {
            polled = true;

            channel.send({ poll, content: `-# ${roleMention(config.roles.movie_nights)}\n## Movie Poll | Please vote below!\n-# ${userMention(user.id)} has created a poll with ${poll.answers.length} choices!\n### Movies\n${movies.map((m, i) => `> ${i + 1}. [${formatMovieString(m, true)}](<${sentContainers[m.id.toString()] ? `${sentContainers[m.id.toString()]}` : `https://themoviedb.org/movie/${m.id}`}>)`).join("\n")}\n### ⬆️ Scroll up in this channel to view an overview for each movie\n### ⬇️ Vote in the poll below! ⬇️\n\n-# **Voting Ends:** <t:${Math.floor((Date.now() + (((duration * 60) * 60) * 1000)) / 1000)}:R>` }).then(m => {
                if (interaction && interaction.replied) interaction.editReply({ content: `Sent poll successfully: ${m.url}` })
                if (interaction && channel.id === interaction.channelId) interaction.followUp({ flags: [MessageFlags.Ephemeral], content: `Sent poll successfully: ${m.url}` })
                if (replaceMsg.editable) replaceMsg.edit({ content: `# ⬇️ [Back to poll](<${m.url}>)` })
                setTimeout(async () => {
                    if (m.poll) await m.poll.end()
                }, 10e3)
            }).catch(e => {
                if(interaction) interaction.editReply({ content: `Something went wrong: ${e?.message || "No error message"}` })
            })
        }
    }, 1e3)
}

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
        },
        {
            name: "poll",
            type: ApplicationCommandOptionType.Subcommand,
            description: "Send a poll with up to 10 different movie choices",
            options: [
                {
                    name: "channel",
                    description: "Where to send the poll",
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread],
                    required: true
                },
                {
                    name: "poll_duration",
                    description: "How long should the poll last?",
                    type: ApplicationCommandOptionType.Number,
                    choices: [{ name: '1 Hour', value: 1 }, { name: '4 Hours', value: 4 }, { name: '8 Hours', value: 8 }, { name: '24 Hours', value: 24 }, { name: '3 Days', value: 72 }],
                    required: true
                },
                {
                    name: "allow_multiple_votes",
                    description: "Allow users to vote for multiple choices",
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                },
                {
                    name: "movie-1",
                    description: "Search for the first movie (required)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true
                },
                {
                    name: "movie-2",
                    description: "Search for the second movie (required)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true
                },
                {
                    name: "movie-3",
                    description: "Search for the third movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-4",
                    description: "Search for the fourth movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-5",
                    description: "Search for the fifth movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-6",
                    description: "Search for the sixth movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-7",
                    description: "Search for the seventh movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-8",
                    description: "Search for the eighth movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-9",
                    description: "Search for the ninth movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                },
                {
                    name: "movie-10",
                    description: "Search for the tenth movie (optional)",
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: false
                }
            ]
        }
    ],
    autocomplete: async (interaction: AutocompleteInteraction) => {

        let focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === "query" || focusedOption.name.startsWith("movie-")) {

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

                if (results.length < MAX && (movie?.genre_ids || []).length > 0 && movie.id) results.push({ name: `${formatMovieString(movie, true, true, 90)}`, value: `${movie.id}` })
            })

            console.log("RESULTS", results);
            results = results.sort((a, b) => a.name.localeCompare(b.name))


            if (results.length > 0) await interaction.respond(results);
        }
    },
    run: async (interaction: ChatInputCommandInteraction) => {
        let subcommand = interaction.options.getSubcommand(true);

        if (subcommand === "search") {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            let movieId = interaction.options.getString('query', true);
            let movie = await getMovieById(movieId, interaction.guildId);
            if (!movie) return interaction.editReply({ content: `Movie ID ${movieId} not found.` });

            let movieContainer = await buildMovieContainer(movie);

            interaction.editReply({
                flags: [MessageFlags.IsComponentsV2], components: [movieContainer.buildContainer()
                ]
            })

        }

        if (subcommand === "poll") {


            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            let movieIds: Record<string, string | null> = {
                '1': interaction.options.getString('movie-1', true),
                '2': interaction.options.getString('movie-2', true),
                '3': interaction.options.getString('movie-3', false) || null,
                '4': interaction.options.getString('movie-4', false) || null,
                '5': interaction.options.getString('movie-5', false) || null,
                '6': interaction.options.getString('movie-6', false) || null,
                '7': interaction.options.getString('movie-7', false) || null,
                '8': interaction.options.getString('movie-8', false) || null,
                '9': interaction.options.getString('movie-9', false) || null,
                '10': interaction.options.getString('movie-10', false) || null
            }

            let channel = interaction.options.getChannel("channel", true);

            let multiselect = interaction.options.getBoolean("allow_multiple_votes", true);
            let duration = interaction.options.getNumber("poll_duration", true);

            await sendMoviePoll(interaction, interaction.user, interaction.guildId, channel as TextChannel, Object.values(movieIds), multiselect, duration as any);

        }
    }
}

export default MovieCommand;