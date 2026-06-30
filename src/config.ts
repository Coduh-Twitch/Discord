const labsChannelId = `1504618200845910138`;
const dev_mode = process.argv.includes("-dev");

const config = {
  coduh: "479563592903950347",
  polls_enabled: false,
  guild: dev_mode ? process.env.DEV_GUILD_ID : process.env.GUILD_ID,
  valid_guilds: ["1032419712950349895", "834901822317002773"], // dev - coduh
  brand_color: 0x256f81,
  legacy_point_name: "doubloon".toLowerCase().replaceAll(" ", "_"),
  point_name: (lower: boolean = false, spaces: boolean = true) => {
    let n = "Point";
    let s = lower ? n.toLowerCase() : n;
    return spaces ? s.replaceAll("_", " ") : s.replaceAll(" ", "_");
  },
  channels: {
    reminders: "1521370244717744198",
    daily_questions: "1521094057043169351",
    hangout: "1485227800796332162",
    rules: "1504618087717142628",
    streams: "1504597672294875147",
    logs: "1504617631632724088",
    labs: labsChannelId,
    joins: "1504596794997342249",
    jackbox: "1504597371923992737",
    wordle: "1504597381583470754",
    movie_suggestions: "1504597448075640872",
    movie_polls: "1490473115795324968",
    announcements: "1491228014137053185",
    movie_night_stage: "1491227901704671402",
    honeypot: "1508957709435932855",
    media_channels: [
      {
        emojis: null,
        id: "1492651333587566652",
      },
      {
        emojis: {
          up: "1443819361579045046",
          down: "💩",
        },
        id: "1492652051874713630",
      },
    ],
    xp_ignore_categories: [],
  },
  emojis: {
    upvote: "⬆️",
    downvote: "⬇️",
    points: "🪙",
  },
  roles: {
    daily_questions: "1521099679306092664",
    members: dev_mode ? "1489808915129696256" : "1489808915129696256",
    movie_nights: dev_mode ? "1489939664679735386" : "1489939664679735386",
    twitch_subscriber: "1485264523462967468",
    vip: "1507284655425196174",
    levels: {
      "1": "1485264201235562617", // 24th Place
      "2": "1485264196869558383", // Intermission Lover
      "3": "1485264194709360660", // 8,000 VR
      "4": "1485264192515866784", // Cracked
      "5": "1485264190255136900", // Sweat
      "6": "1485264187306541088", // Touch Grass
      "7": "1485264185213583380", // Built Different
      "8": "1485264182965178600", // Track Demon
      "9": "1485264180847186054", // Kiyoh
      "10": "1485264172534206606", // Frontrunner
    },
  },
  level_perks: {
    "6": "Slowed XP Degredation",
    "7": "an Emoji of Your Choice",
    "8": "a Custom Soundboard",
    "9": "a Custom Role",
    "10": ["a hoisted Custom Role", "VIP on Twitch"],
  },
  xp_multipliers: {
    base: 1,
    sub: 1.1,
  },
  point_multipliers: {
    base: 1,
    sub: 1.1,
  },
};

console.log(dev_mode);
console.log(config);

export default config;
