
const labsChannelId = `1485227800796332162`;
const dev_mode = process.argv.includes("-dev");

const config = {
    coduh: "479563592903950347",
    polls_enabled: false,
    guild: dev_mode ? process.env.DEV_GUILD_ID : process.env.GUILD_ID,
    valid_guilds: ["1032419712950349895", "834901822317002773"], // dev - coduh
    brand_color: 0x256F81,
    channels: {
        hangout: dev_mode ? labsChannelId : "1485227800796332162",
        new_videos: dev_mode ? labsChannelId : "1485227800796332162",
        rules: dev_mode ? labsChannelId : "1485227800796332162",
        about: dev_mode ? labsChannelId : "1485227800796332162",
        streams: dev_mode ? labsChannelId : "1485227800796332162",
        pets: dev_mode ? labsChannelId : "1485227800796332162",
        setups: dev_mode ? labsChannelId : "1485227800796332162",
        lfg: dev_mode ? labsChannelId : "1485227800796332162",
        logs: dev_mode ? labsChannelId : "1485227800796332162",
        labs: labsChannelId,
        announcements: "1491228014137053185",
        movie_night_stage: "1491227901704671402",
        media_channels: [
            {
                emojis: null,
                id: "1492651333587566652"
            }
        ]
    },
    emojis: {
        upvote: "⬆️",
        downvote: "⬇️"
    },
    roles: {
        members: dev_mode ? "1489808915129696256" : "1489808915129696256",
        movie_nights: dev_mode ? "1489939664679735386" : "1489939664679735386",
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
            "10": "1485264172534206606",// Frontrunner
        },
        twitch_subscriber: "1485264523462967468"
    },
    level_perks: {
        "6": "Slowed XP Degredation",
        "7": "an Emoji of Your Choice",
        "8": "a Custom Soundboard",
        "9": "a Custom Role",
        "10": ["a hoisted Custom Role", "VIP on Twitch"],
        "50": "Coduh eats ass live on stream NO ONLYFANS!"
    },
    xp_multipliers: {
        base: 1,
        sub: 1.1,
    }
}

console.log(dev_mode)
console.log(config);

export default config;