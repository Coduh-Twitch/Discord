import {
  ApplicationCommandAutocompleteStringOptionData,
  ApplicationCommandOptionChoiceData,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  blockQuote,
  ChatInputCommandInteraction,
  codeBlock,
  Colors,
  ContainerBuilder,
  Events,
  inlineCode,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorComponent,
  SeparatorSpacingSize,
  TextBasedChannel,
  User,
  userMention,
  VoiceBasedChannel,
} from "discord.js";
import { Command, CommandCategory, UserLevel } from "../classes/Command";
import {
  Canvas,
  CanvasGradient,
  CanvasRenderingContext2D,
  createCanvas,
  Image,
} from "canvas";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { memberWelcomeImage, wouldYouRatherImage } from "../utils/canvasUtils";
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
} from "@discordjs/voice";
import { EdgeTTS } from "node-edge-tts";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";
import { dev_mode, player } from "..";
import { userModel } from "../models/user";
import config from "../config";
import { calculateGivenXP, calculateRequiredXP } from "../utils/xpUtils";
import { appendFileSync, createReadStream, ensureFileSync } from "fs-extra";
import { get } from "axios";
import os from "node:os";
import { truncate } from "./movie";

let voiceConnection: VoiceConnection | null = null;
let joinedChannel: VoiceBasedChannel | null = null;
let voiceHost: User | null = null;

function utterPath(id: string) {
  return join(process.cwd(), "temp", `utterance_${id}.webm`);
}

function randomString(max: number = 100): string {
  let chars = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
  ];
  let toReturn = "";

  for (var i = 0; i <= max; i++) {
    toReturn += chars[Math.floor(Math.random() * chars.length)] || "a";
  }

  return toReturn;
}

/*
// await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
// let user = interaction.options.getUser("user", false);
// let m = interaction.guild.members.cache.get(
//   user ? user.id : interaction.user.id,
// );
//
// // return interaction.editReply({
// //   files: [(await memberWelcomeImage(m)).attachment],
// // });
//
// interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [TMComponentBuilder.textDisplay("Hello"), TMComponentBuilder.separator(), TMComponentBuilder.textDisplay("Mayhaps?")]})
//
// // let dbUser = await userModel.findOne({id: m.id});
//
// // if(dbUser) dbUser.set("shownWelcomeMessage", false);
// // if(dbUser) await dbUser.save();
//
// // if(m.roles.cache.has(config.roles.members)) {
// //     m.roles.remove(config.roles.members).then(() => {
// //         m.roles.add(config.roles.members);
// //     })
// // }
//
// // let cont = new TMComponentBuilder();
//
// // let str = [];
//
// // for(var ii = 1; ii <= 100; ii++) {
// //     str.push(`- Level ${ii}: ${calculateRequiredXP(ii).toLocaleString()} XP`)
// // }
//
// // let max = 500;
// // let totalXp = 0;
// // let totalCharacters = 0;
//
// // let filePath = join(process.cwd(), "xp-report.txt")
// // ensureFileSync(filePath);
// // writeFileSync(filePath, "", {encoding: "utf-8"});
//
// // for(var i = 1; i <= max; i++) {
// //     let randStr = randomString(Math.floor(Math.random() * 100));
// //     let xpGiven = calculateGivenXP(randStr);
// //     let logStr = `${i === 1 ? `---` : ""}\nContent: ${randStr}\nLength: ${randStr.length}\nXP Given: ${xpGiven}\n---`;
// //     // cont.addTextDisplay(`**Message Length**: ${randStr.length}\n**XP Given**: ${xpGiven.toLocaleString()}`)
// //     // cont.addSeparator();
// //     totalXp+=xpGiven;
// //     totalCharacters+=randStr.length;
//
// //     appendFileSync(filePath, logStr, {encoding: "utf8"});
// // }
//
// // let finalStr = `\nTotal XP Given: ${totalXp}\nTotal Messages: ${max}\nTotal Characters: ${totalCharacters}`;
//
// // appendFileSync(filePath, finalStr, {encoding: "utf8"});
// // appendFileSync(filePath, `\n---\nLevel Requirements:\n${str.join("\n")}\nEND`)
//
// // let file = createReadStream(filePath);
// // let attachment = new AttachmentBuilder(file).setName("xp-report.txt");
//
// // cont.addTextDisplay(`-# XP Review\n\n**Total XP Given:** ${totalXp.toLocaleString()}\n**Total Messages**: ${max}\n**Total Characters:** ${totalCharacters.toLocaleString()}`)
// // cont.addSeparator();
// // cont.addFile("attachment://xp-report.txt")
// // cont.addTextDisplay(`-# Saved to \`${filePath}\``)
//
// // interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [cont.buildContainer()], files: [attachment]})
// //
// // let image = await wouldYouRatherImage(1021, [
// //   {
// //     answer_text: "10 extra limbs on yur body gng",
// //     index: 1,
// //     question_id: "99",
// //     votes: 5,
// //   },
// //   {
// //     answer_text: "fingers gone",
// //     index: 2,
// //     question_id: "99",
// //     votes: 12,
// //   },
// // ]);
// // interaction.channel.send({ files: [image.attachment] });
*/

interface OpenLibrarySearchedWork {
  author_key: string[];
  author_name: string[];
  cover_height: number;
  cover_i: number;
  cover_width: number;
  ebook_access: string;
  edition_count: number;
  first_publish_year: number;
  has_fulltext: boolean;
  ia: string[];
  ia_collection: string[];
  key: string;
  language: string[];
  lending_edition_s: string;
  lending_identifier_s: string;
  public_scan_b: boolean;
  title: string;
}

interface OpenLibrarySearchResponse {
  numFound: number;
  start: 0;
  numFoundExact: true;
  num_found: number;
  documentation_url: string;
  q: string;
  offset: number | null;
  docs: OpenLibrarySearchedWork[];
}

interface OpenLibraryTypeRef {
  key: string;
}

interface OpenLibraryDatetime {
  type: "/type/datetime";
  value: string;
}

interface OpenLibraryLink {
  title: string;
  url: string;
  type: OpenLibraryTypeRef;
}

interface OpenLibraryExcerpt {
  excerpt: string;
  comment: string;
  author: OpenLibraryTypeRef;
}

interface OpenLibraryAuthorRole {
  author: OpenLibraryTypeRef;
  type: OpenLibraryTypeRef;
}

interface OpenLibraryWork {
  key: string;
  title: string;
  type: OpenLibraryTypeRef;
  description?: string;
  links?: OpenLibraryLink[];
  covers?: number[];
  excerpts?: OpenLibraryExcerpt[];
  first_publish_date?: string;
  authors?: OpenLibraryAuthorRole[];
  subjects?: string[];
  subject_places?: string[];
  subject_people?: string[];
  subject_times?: string[];
  genres?: string[];
  latest_revision: number;
  revision: number;
  created: OpenLibraryDatetime;
  last_modified: OpenLibraryDatetime;
}

interface OpenLibraryAuthorRemoteIds {
  isni?: string;
  librarything?: string;
  wikidata?: string;
  viaf?: string;
  amazon?: string;
  storygraph?: string;
  goodreads?: string;
  bookbrainz?: string;
  musicbrainz?: string;
  imdb?: string;
  opac_sbn?: string;
  lc_naf?: string;
  gnd?: string;
  [provider: string]: string | undefined;
}

interface OpenLibraryAuthor {
  key: string;
  name: string;
  type: OpenLibraryTypeRef;
  personal_name?: string;
  alternate_names?: string[];
  birth_date?: string;
  death_date?: string;
  bio?: string;
  photos?: number[];
  links?: OpenLibraryLink[];
  remote_ids?: OpenLibraryAuthorRemoteIds;
  source_records?: string[];
  latest_revision: number;
  revision: number;
  created: OpenLibraryDatetime;
  last_modified: OpenLibraryDatetime;
}

interface OpenLibraryTag {
  key: string;
  name: string;
  type: OpenLibraryTypeRef;
  tag_type: string;
  slugs: string[];
  tag_description?: string;
  latest_revision: number;
  revision: number;
  created: OpenLibraryDatetime;
  last_modified: OpenLibraryDatetime;
}

async function searchBookTitle(title: string, returnList: boolean = false): Promise<(OpenLibrarySearchedWork | null) | OpenLibrarySearchedWork[]> {
  const BASE_URL = "https://openlibrary.org"
  const res = await get(`${BASE_URL}/search.json?q=${encodeURIComponent(title)}`);
  if (!res.data || res.status !== 200) return null;
  let books: OpenLibrarySearchResponse = res.data;
  if (books.numFound <= 0) return null;
  if(books?.docs) books.docs = books.docs.filter(d => d.language && d.language.some(l => l.toLowerCase() === "eng") && (d.ia_collection && !d.ia_collection.some(c => c.toLowerCase() === "bannedbooks")));
  if (returnList) return (books?.docs || []) as OpenLibrarySearchedWork[];
  return books.docs?.[0] || null;
}

async function searchBooks(query: string): Promise<ApplicationCommandOptionChoiceData[]> {
  const search: OpenLibrarySearchedWork[] = await searchBookTitle(query, true) as OpenLibrarySearchedWork[];
  if (!search || search.length <= 0) return [{ name: `Nothing found for search "${query}"`, value: "none" }];
  return search.map(book => ({ name: `${truncate(book.title, 30)} - ${truncate(book.author_name?.[0] || "No Author", 30)}`, value: book.key.split("/")[book.key.split("/").length - 1].trim() })).slice(0,10)
}

async function getWorkById(id: string): Promise<OpenLibraryWork | null> {
  if (id.includes("/")) id = id.split("/")[id.split("/").length - 1].trim();
  const BASE_URL = "https://openlibrary.org"
  const res = await get(`${BASE_URL}/works/${id}.json`);
  if (!res.data || res.status !== 200) return null;
  let book: OpenLibraryWork = res.data;
  console.log(book)
  if (book && book?.description && typeof (book.description) === "string") {
    book.description = book.description.split("\r")[0].trim()
  } else if (book && book.description && typeof (book.description) === "object") {
    let desc: { type: string; value: string; } = book.description as any;
    book.description = desc.value.split("\r")[0].trim()
  }
  if(!book?.description || !book.description.includes(" ")) book.description = "No description found."
  if(book && book.key.includes("/")) book.key = book.key.split("/")[book.key.split("/").length - 1].trim();
  return book || null;
}

async function getTagById(id: string): Promise<OpenLibraryTag | null> {
  if (id.includes("/")) id = id.split("/")[id.split("/").length - 1].trim();
  const BASE_URL = "https://openlibrary.org"
  const res = await get(`${BASE_URL}/tags/${id}.json`);
  if (!res.data || res.status !== 200) return null;
  let tag: OpenLibraryTag = res.data;
  return tag || null;
}

async function getAuthorById(id: string): Promise<OpenLibraryAuthor | null> {
  if (id.includes("/")) id = id.split("/")[id.split("/").length - 1].trim();
  const BASE_URL = "https://openlibrary.org"
  const res = await get(`${BASE_URL}/authors/${id}.json`);
  if (!res.data || res.status !== 200) return null;
  let author: OpenLibraryAuthor = res.data;
  return author || null;
}

async function buildBookDisplayContainer(book: OpenLibraryWork): Promise<ContainerBuilder> {
  let author: OpenLibraryAuthor | null = null;
  if (book.authors && book.authors.length > 0 && book.authors?.[0]?.author) author = await getAuthorById(book.authors[0].author.key);
  const container = new TMComponentBuilder();
  let coverId = (book?.covers || []).filter(c => c !== -1)?.[0];
  let genres = await Promise.all((book?.genres || []).map(async (g) => {
    return await getTagById(g);
  }));

  const headingStr = `## ${book.title}${author ? ` - ${author.name}` : ""}\n-# ${(genres.length > 0 ? genres : [{name: "No Genre Listed"}]).map(g => inlineCode(g.name)).join(" ")}${book?.excerpts && book.excerpts.length > 0 ? `\n\n> *"${book.excerpts[0].excerpt}"*` : ""}`;
  if (coverId) {
    container.addThumbnailAccessorySection(headingStr, `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`)

  } else {
    container.addTextDisplay(headingStr)
  }



  container.addSeparator()
  container.addTextDisplay(`> ${book?.description || "No Description"}`)

  container.addSeparator(SeparatorSpacingSize.Large, false);
  container.addTextDisplay(`-# [View on OpenLibrary](https://openlibrary.org/works/${book.key}) | [Search on bookshop.org](https://bookshop.org/beta-search?keywords=${encodeURIComponent(`${book.title} ${author ? author.name : ""}`.trim())})`)

  return container.buildContainer();
}

const SandboxCommand: Command = {
  enabled: os.hostname() === "ducky",
  category: CommandCategory.DEV,
  requiredRole: UserLevel.DEV,
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  name: "sandbox",
  description: "Testing command",
  options: [
    {
      name: "query",
      description: "book",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true
    },
  ],
  autocomplete: async (interaction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "query") {
      let query = focused.value.trim();
      if (query === "") return await interaction.respond([{ name: "Start typing to search...", value: "none" }]);
      const searched = await searchBooks(query);
      console.log(query, searched)
      await interaction.respond(searched);
    }
  },
  run: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply()
    const bookId = interaction.options.getString("query", true);
    if(bookId === "none") return interaction.editReply("Nope!")
    const book = await getWorkById(bookId);
    console.log(book.key)

    const container = await buildBookDisplayContainer(book);

    await interaction.editReply({flags: [MessageFlags.IsComponentsV2], components: [container] })
  },
};

export default SandboxCommand;
