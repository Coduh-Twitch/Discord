
const labsChannelId = `1485227800796332162`;
const dev_mode = process.argv.includes("-dev");

const config = {
    polls_enabled: false,
    guild: dev_mode ? process.env.DEV_GUILD_ID : process.env.GUILD_ID,
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
        labs: labsChannelId
    },
    emojis: {
        chow: "<:_:1489149500428779601>",
        dance: "<:_:1489149500428779601>",
        lol: "<:_:1489149500428779601>",
        instagram: "<:_:1489149500428779601>",
        tiktok: "<:_:1489149500428779601>",
        twitch: "<:_:1489149500428779601>",
        youtube: "<:_:1489149500428779601>",
        "1": "<:_:1489149500428779601>",
        "2": "<:_:1489149500428779601>",
        "3": "<:_:1489149500428779601>",
        "4": "<:_:1489149500428779601>",
        "5": "<:_:1489149500428779601>",
        "6": "<:_:1489149500428779601>",
        "7": "<:_:1489149500428779601>",
        "8": "<:_:1489149500428779601>",
        "9": "<:_:1489149500428779601>",
        "10": "<:_:1489149500428779601>",
    },
    roles: {
        members: dev_mode ? "1485264559706079393" : "1485264559706079393",
        levels: {
            "1": "1485264201235562617",
            "2": "1485264196869558383",
            "3": "1485264194709360660",
            "4": "1485264192515866784",
            "5": "1485264190255136900",
            "6": "1485264187306541088",
            "7": "1485264185213583380",
            "8": "1485264182965178600",
            "9": "1485264180847186054",
            "10": "1485264172534206606",
        },
        twitch_subscriber: "1485264523462967468"
    },
    level_perks: {
        "6": "Slowed XP Degredation",
        "7": "an Emoji of Your Choice",
        "8": "a Custom Soundboard",
        "9": "a Custom Role",
        "10": ["your Custom Role: Hoisted"],
    },
    xp_multipliers: {
        base: 1,
        sub: 1.1,
    }
}

console.log(dev_mode)
console.log(config);

export default config;