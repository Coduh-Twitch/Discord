import { ApplicationCommandOptionChoiceData, ApplicationCommandOptionType, AutocompleteInteraction, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, Component, ComponentType, Locale, MessageFlags, resolveColor, SelectMenuComponent, SeparatorSpacingSize } from "discord.js";
import { Command, CommandCategory } from "../classes/Command"
import { TMComponentBuilder } from "../classes/ComponentBuilder"
import { getAverageColor } from "fast-average-color-node";
import { DBUser, userModel } from "../models/user"
import { appEmoji } from "../utils/emojiUtils"
import axios from "axios";
import { buildMovieContainer, formatMovieString, getMovieById, TMDBMovieFull } from "./movie";
import config from "../config"
import { client } from "..";

async function favoriteMovieString(movies: string[]): Promise<string> {
    let str = "";

    let movieList = await Promise.all(movies.map(async (mId) => await getMovieById(mId, config.guild)));
    str = (await Promise.all(movieList.map(async (movie, index) => `${index === 0 ? await appEmoji(client, "crown") : await appEmoji(client, `${index + 1}_`)} [${formatMovieString(movie, true, false)}](https://themoviedb.org/movie/${movie.id})`))).join("\n");

    return str;
}

function array_move(arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr;
};

const ProfileCommand: Command = {
    enabled: true,
    category: CommandCategory.MISC,
    name: "profile",
    description: "Profile-related commands",
    options: [
        {
            name: "view",
            description: "See another user's profile",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "The user who's profile you'd like to see",
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
            ]
        },
        {
            name: "movies",
            description: "Movie-related profile commands",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
                {
                    name: "add",
                    description: "Add a favorite movie to your profile",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "movie",
                            description: "Search for the movie!",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                            required: true
                        }
                    ]
                },
                {
                    name: "remove",
                    description: "Remove a favorite movie from your profile",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "movie",
                            description: "The movie to remove from your profile",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                            required: true
                        }
                    ]
                },
                {
                    name: "reorder",
                    description: "Change the order of your favorite movies list",
                    type: ApplicationCommandOptionType.Subcommand,
                }
            ]
        }
    ],
    autocomplete: async (interaction: AutocompleteInteraction) => {
        let focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === "movie" && interaction.options.getSubcommand() === "add") {
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

        if (focusedOption.name === "movie" && interaction.options.getSubcommand() === "remove") {
            let results: ApplicationCommandOptionChoiceData[] = [];
            let MAX = 5;
            let query = focusedOption.value;

            let dbUser = await userModel.findOne({ id: interaction.user.id });
            if (!dbUser || dbUser.favorite_movies.length <= 0) results = [{ name: "You do not have any favorited movies", value: "none" }]

            // let res = await tmdb.get("/search/movie", {query: query});

            let movies = await Promise.all(dbUser.favorite_movies.map(async mId => await getMovieById(mId, interaction.guildId)));
            let res = movies.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));

            if ((!res) && query !== "") results = [{ name: "No results found, please try another query.", value: "none" }];


            // if (res?.results) res.results.forEach(async movie => {

            //     if (results.length < MAX && (movie?.genre_ids || []).length > 0 && movie.id) results.push({ name: `${formatMovieString(movie, true, true, 90)}`, value: `${movie.id}` })
            // })

            results = res.map(m => ({ name: formatMovieString(m, true, true, 90), value: m.id.toString() }))

            console.log("RESULTS", results);
            results = results.sort((a, b) => a.name.localeCompare(b.name))


            if (results.length > 0) await interaction.respond(results);
        }
    },
    run: async (interaction: ChatInputCommandInteraction) => {

        let subcommand = interaction.options.getSubcommand(false);

        if(subcommand === "reorder") {
            let res = await interaction.deferReply({ flags: [
                MessageFlags.Ephemeral

            ], withResponse: true });

            let dbUser = await userModel.findOne({id: interaction.user.id});
            if(!dbUser || dbUser.favorite_movies.length <= 0) return interaction.editReply({content: `You do not have any favorited movies (yet!) Start with </profile movies add:${interaction.commandId}>`})
            if(dbUser.favorite_movies.length === 1) return interaction.editReply({content: `You only have one favorited movie! Add more with </profile movies add:${interaction.commandId}>`})

            let movies = await Promise.all(dbUser.favorite_movies.map(async mId => await getMovieById(mId, interaction.guildId)));


            let expirationTime = 120e3;
            let date = Date.now();
            let movie = null;

            
            async function buildOrderContainer(movies: TMDBMovieFull[], selectedMovie: TMDBMovieFull | null): Promise<TMComponentBuilder> {
                let movieIds = movies.map(m => m.id);
                let orderContainer = new TMComponentBuilder();
                orderContainer.setAccentColor(Colors.Yellow);

                let position = selectedMovie ? movieIds.indexOf(selectedMovie.id) + 1 : 0;

                orderContainer.addTextDisplay(`## Re-Ordering Favorite Movies (${movies.length})\n\n${(await Promise.all(movies.filter(m => m !== null).map(async (m, i) => `${await appEmoji(interaction.client, `${i+1}_`)} ${selectedMovie && m.id === selectedMovie?.id ? `**${formatMovieString(m, true, false)}**` : formatMovieString(m, true, false)}`))).join("\n")}`);
    
                orderContainer.addSeparator();
                orderContainer.addStringSelectMenu({action: "select", interactionId: interaction.id}, "Select Movie", movies.map((m, i) => ({label: formatMovieString(m, true, true, 30), value: m.id.toString(), default: false, description: `#${i+1} favorite`})), false, 1, 1)
                if(selectedMovie) orderContainer.addTextDisplay(`-# Moving **${formatMovieString(selectedMovie, true, false)}** (#${position})`)
                orderContainer.addButtonActionRow([
                    TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "\t", null, {name: config.emojis.upvote}, {action: "up", interactionId: interaction.id}).setDisabled(!selectedMovie || position === 1),
                    TMComponentBuilder.accessoryButton(ButtonStyle.Primary, "\t", null, {name: config.emojis.downvote}, {action: "down", interactionId: interaction.id}).setDisabled(!selectedMovie || position === 5),
                    TMComponentBuilder.accessoryButton(ButtonStyle.Danger, "Finish", null, null, {action: "done", interactionId: interaction.id}),
                ])

                orderContainer.addSeparator().addTextDisplay(`This interaction expires <t:${Math.floor((date + expirationTime) / 1000)}:R>`)

                return orderContainer;
            }

            await interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [(await buildOrderContainer(movies, null)).buildContainer()]});

            let selectCol = res.resource.message.createMessageComponentCollector({componentType: ComponentType.StringSelect, filter: i => i.user.id === interaction.user.id, time: expirationTime});
            let buttonCol = res.resource.message.createMessageComponentCollector({componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, max: 100})

            selectCol.on("collect", async select => {
                await select.deferUpdate();
                let movieId = select.values[0];
                let m = await getMovieById(movieId, interaction.guildId);
                await interaction.editReply({components: [(await buildOrderContainer(movies, m)).buildContainer()]})
                movie = m;
            })

            buttonCol.on("collect", async button => {

                if(button.customId.includes("done")) {
                        await button.deferUpdate();

                        let done = new TMComponentBuilder();
                        done.setAccentColor(Colors.Green);
                        done.addTextDisplay(`## Finished Re-Ordering Movies!`);

                        interaction.editReply({components: [done.buildContainer()]});
                        return;
                    }

                if(movie) {
                    await button.deferUpdate();

                    if(button.customId.includes("up")) {
                        let list = movies.map(m => m.id);
                        let position = list.indexOf(movie.id);
                        let newList: number[] = array_move(list, position, position - 1);
                        let ml: TMDBMovieFull[] = await Promise.all(newList.map(async mId => await getMovieById(mId.toString(), interaction.guildId)));

                        dbUser.set("favorite_movies", newList.map(i => i.toString()));
                        await dbUser.save();

                        movies = ml;

                        await interaction.editReply({components: [(await buildOrderContainer(ml, movie)).buildContainer()]})
                    }
                    if(button.customId.includes("down")) {
                        let list = movies.map(m => m.id);
                        let position = list.indexOf(movie.id);
                        let newList: number[] = array_move(list, position, position + 1);
                        let ml: TMDBMovieFull[] = await Promise.all(newList.map(async mId => await getMovieById(mId.toString(), interaction.guildId)));

                        dbUser.set("favorite_movies", newList.map(i => i.toString()));
                        await dbUser.save();

                        movies = ml;

                        await interaction.editReply({components: [(await buildOrderContainer(ml, movie)).buildContainer()]})
                    }

                    
                } else {
                    await button.deferReply({flags: [MessageFlags.Ephemeral]});
                    await button.editReply({content: `Please select a movie first.`})
                }
            })

            selectCol.on("end", async (col, reason) => {
                let expired = new TMComponentBuilder();
                expired.setAccentColor(Colors.Red);
                expired.addTextDisplay(`## Interaction Expired\nRun this command again: </profile movies reorder:${interaction.commandId}>`)
                
                if(reason === "time") return interaction.editReply({ components: [expired.buildContainer()] })
            })
        }

        if (subcommand === "remove") {
            let res = await interaction.deferReply({ flags: [
                MessageFlags.Ephemeral

            ], withResponse: true });

            let movieId = interaction.options.getString('movie', true);
            let movie = await getMovieById(movieId, interaction.guildId);
            if (!movie) return interaction.editReply({ content: `Movie ID ${movieId} not found.` });

            if(interaction.user.id === config.coduh && movieId === "564638") return interaction.editReply({content: "You can't do that. You can't escape da truth."})

            let dbUser = await userModel.findOne({ id: interaction.user.id });
            if (!dbUser || dbUser.favorite_movies.length <= 0 || !dbUser.favorite_movies.includes(movie.id.toString())) return interaction.editReply({ content: `**${formatMovieString(movie, true, false)}** is not on your favorite movie list.` })

            let expirationTime = 60e3;

            let removeContainer = new TMComponentBuilder();
            removeContainer.setAccentColor(Colors.Yellow);
            removeContainer.addThumbnailAccessorySection(`## Removing from Favorites\nAre you sure you want to remove **${formatMovieString(movie, true, false)}** from your favorites?`, `https://image.tmdb.org/t/p/w780${movie.poster_path}`);
            removeContainer.addButtonActionRow([
                TMComponentBuilder.accessoryButton(ButtonStyle.Danger, "Remove", null, null, { action: "yes", interactionId: interaction.id }),
                TMComponentBuilder.accessoryButton(ButtonStyle.Secondary, "Cancel", null, null, { action: "no", interactionId: interaction.id })
            ])
            removeContainer.addSeparator(SeparatorSpacingSize.Small, false);
            removeContainer.addTextDisplay(`-# This interaction will expire <t:${Math.floor((Date.now() + expirationTime) / 1000)}:R>`)

            await interaction.editReply({ flags: [MessageFlags.IsComponentsV2], components: [removeContainer.buildContainer()] });

            let button: ButtonInteraction | null;
            button = await res.resource.message.awaitMessageComponent({ componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, time: expirationTime }).catch(e => button = null);

            if (!button) {
                let expired = new TMComponentBuilder();
                expired.setAccentColor(Colors.Red);
                expired.addTextDisplay(`## Interaction Expired\nRun this command again:\n\`\`\`/profile movies remove movie:${movie.id}\`\`\``)

                interaction.editReply({ components: [expired.buildContainer()] })
            } else if (button.customId.includes("yes")) {
                button.deferUpdate();

                let updatedContainer = new TMComponentBuilder();
                updatedContainer.setAccentColor(Colors.Green);

                let newFavorites = dbUser.favorite_movies.filter(m => m !== movie.id.toString());
                dbUser.set("favorite_movies", newFavorites);
                updatedContainer.addTextDisplay(`${await appEmoji(interaction.client, "coduhlove")} Updated movie favorites!\n\n${await favoriteMovieString(newFavorites)}`)
                await dbUser.save();
                await interaction.editReply({ components: [updatedContainer.buildContainer()] });

            } else {
                button.deferUpdate();
                let cancelled = new TMComponentBuilder();
                cancelled.setAccentColor(Colors.Red);
                cancelled.addTextDisplay(`## Request Cancelled`)

                interaction.editReply({ components: [cancelled.buildContainer()] })
            }
        }

        if (subcommand === "add") {
            let res = await interaction.deferReply({ flags: [
                MessageFlags.Ephemeral
            ], withResponse: true });
            let dbUser = await userModel.findOne({ id: interaction.user.id });
            if (dbUser && dbUser.favorite_movies.length === 5) return interaction.editReply({ content: `You already have 5 listed favorites! Remove some with \`/profile movies remove\`` })

            let movieId = interaction.options.getString('movie', true);
            let movie = await getMovieById(movieId, interaction.guildId);
            if (!movie) return interaction.editReply({ content: `Movie ID ${movieId} not found.` });

            let movieContainer = await buildMovieContainer(movie);

            let expirationTime = 60e3;

            movieContainer.addSeparator()
            movieContainer.addTextDisplay(`## Add to Favorites?`)
            movieContainer.addButtonActionRow([
                TMComponentBuilder.accessoryButton(ButtonStyle.Success, "Yes", null, null, { action: "yes", interactionId: interaction.id }),
                TMComponentBuilder.accessoryButton(ButtonStyle.Danger, "No", null, null, { action: "no", interactionId: interaction.id })
            ])
            movieContainer.addSeparator(SeparatorSpacingSize.Small, false);
            movieContainer.addTextDisplay(`-# This interaction will expire <t:${Math.floor((Date.now() + expirationTime) / 1000)}:R>`)

            await interaction.editReply({
                flags: [MessageFlags.IsComponentsV2], components: [movieContainer.buildContainer()
                ]
            })

            let button: ButtonInteraction | null;
            button = await res.resource.message.awaitMessageComponent({ componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, time: expirationTime }).catch(e => button = null);
            // console.log(button.customId);

            if (!button) {
                let expired = new TMComponentBuilder();
                expired.setAccentColor(Colors.Red);
                expired.addTextDisplay(`## Interaction Expired\nRun this command again:\n\`\`\`/profile movies add movie:${movie.id}\`\`\``)

                interaction.editReply({ components: [expired.buildContainer()] })
            } else if (button.customId.includes("yes")) {
                button.deferUpdate();

                let updatedContainer = new TMComponentBuilder();
                updatedContainer.setAccentColor(Colors.Green);


                if (!dbUser) {
                    updatedContainer.addTextDisplay(`${await appEmoji(interaction.client, "coduhlove")} Updated movie favorites!\n\n${await favoriteMovieString([movie.id.toString()])}`)
                    let newUser = new userModel({
                        id: interaction.user.id,
                        shownWelcomeMessage: true,
                        favorite_movies: [movie.id.toString()],
                        lastMessageTimestamp: Date.now(),
                        level: 0,
                        xp: 0,
                    })

                    await newUser.save();
                    await interaction.editReply({ components: [updatedContainer.buildContainer()] });
                } else {
                    let newFavorites = [...dbUser.favorite_movies, movie.id.toString()];
                    dbUser.set("favorite_movies", newFavorites);
                    updatedContainer.addTextDisplay(`${await appEmoji(interaction.client, "coduhlove")} Updated movie favorites!\n\n${await favoriteMovieString(newFavorites)}`)
                    await dbUser.save();
                    await interaction.editReply({ components: [updatedContainer.buildContainer()] });
                }

            } else {
                button.deferUpdate();
                let cancelled = new TMComponentBuilder();
                cancelled.setAccentColor(Colors.Red);
                cancelled.addTextDisplay(`## Request Cancelled`)

                interaction.editReply({ components: [cancelled.buildContainer()] })
            }

        } else if (subcommand === "view") {
            await interaction.deferReply();

            let numberFormatter = Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1
            });

            let user = interaction.options.getUser("user", false) || interaction.user;

            let avatar = user.displayAvatarURL({ size: 512 });
            let avc = (await getAverageColor(avatar)).hex.replace("#", "");

            let container = new TMComponentBuilder();
            container.setAccentColor(Number(`0x${avc}`))

            let dbUser = await userModel.findOne({ id: user.id });

            let member = interaction.guild?.members.cache.get(user.id);

            container.addThumbnailAccessorySection(`## @${user.displayName}\n-# ${interaction.guild.ownerId === user.id ? `${await appEmoji(interaction.client, "coduhlove")} ` : ""}${user.bot ? "**BOT**" : user.username} ∙ ${user.id}\n\n${dbUser ? `${config.emojis.points} **${numberFormatter.format(dbUser.points)}** ${config.point_name(false, true)}${dbUser.points === 1 ? "" : "s"} - ✨ Level **${dbUser.level}** _(**${numberFormatter.format(dbUser.xp)}** XP)_` : ""}`, avatar)

            if (!user.bot) {

                container.addSeparator(SeparatorSpacingSize.Small, false);
                if (member?.joinedTimestamp) container.addTextDisplay(`-# Joined Server <t:${Math.floor(member.joinedTimestamp / 1000)}:R> ∙ Account Created <t:${Math.floor(user.createdTimestamp / 1000)}:R>`);

                // let highestRoleName = member?.roles.highest.name;
                // if (highestRoleName) {
                //     container.addSeparator()
                //     container.addButtonAccessorySection(`### Highest Role`, ButtonStyle.Secondary, highestRoleName, { action: "beauty", interactionId: interaction.id })
                // }
                container.addSeparator();
                container.addTextDisplay(`### Favorite Movie${dbUser.favorite_movies.length === 1 ? "" : "s"}\n${dbUser.favorite_movies.length > 0 ? await favoriteMovieString(dbUser.favorite_movies) : `None (yet!)${dbUser.id === interaction.user.id ? ` Set with </profile movies add:${interaction.commandId}>!` : ""}`}`);

            }

            interaction.editReply({ components: [container.buildContainer()], flags: [MessageFlags.IsComponentsV2] })
        }
    }
}

export default ProfileCommand;