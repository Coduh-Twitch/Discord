import { Guild, GuildMember, MessageFlags, TextChannel, User } from "discord.js"
import config from "../config"
import { DBUser, userModel } from "../models/user"
import { TMComponentBuilder } from "../classes/ComponentBuilder"
import { avg, dev_mode } from ".."
import { appEmoji } from "./emojiUtils"

export const calculateGivenPoints = (message_content: string, is_sub: boolean = false): number => {
    let amt: number = 0;
    if (message_content.length < 10) { amt = Math.floor(Math.random() * 30); return amt } else { amt = Math.round(((Math.random() * 3) + 1) * 6) }

    if (is_sub) amt = amt * config.point_multipliers.sub;
    amt = Math.round(amt * config.point_multipliers.base);
    console.log(`Giving ${amt} POINT(S) [SUBSCRIBER? ${is_sub}]`)
    return amt;
}

export const addPoints = async (member: GuildMember, content: string): Promise<DBUser> => {
    let dbUser = await userModel.findOne({ id: member.id });
    if (!dbUser) {
        const newUser = new userModel({
            id: member.id,
            lastMessageTimestamp: Date.now(),
            level: 0,
            xp: 0,
            points: 0,
            shownWelcomeMessage: true,
            favorite_movies: []
        })

        try {
            const doc = await newUser.save();
            dbUser = doc;
        } catch (e) {
            dbUser = null;
            console.log(`Failed to create new user doc for ${member.id}`, e)
        }
    }
    if (!dbUser) return null;
    let current_points = dbUser.points;
    let points_to_give = calculateGivenPoints(content, member.roles.cache.has(config.roles.twitch_subscriber));
    let new_points = current_points + points_to_give;


    try {
        dbUser.set("points", new_points);
        let doc: DBUser = await dbUser.save();
        console.log(`Added ${points_to_give} Point(s) to user ${member.id} (new pts: ${doc.points})`)
        return doc;
    } catch (e) {
        console.log(`Failed to add points to user ${member.id}`, e)
        return null;
    }
}

export const removePoints = async (member: GuildMember, amount: number): Promise<DBUser> => {
    let dbUser = await userModel.findOne({ id: member.id });
    if (!dbUser) {
        const newUser = new userModel({
            id: member.id,
            lastMessageTimestamp: Date.now(),
            level: 0,
            xp: 0,
            points: 0,
            shownWelcomeMessage: true,
            favorite_movies: []
        })

        try {
            const doc = await newUser.save();
            return doc;
        } catch (e) {
            dbUser = null;
            console.log(`Failed to create new user doc for ${member.id}`, e)
        }
    }
    if (!dbUser === null) return null;
    let current_points = dbUser.points;
    
    let new_points = current_points - amount;
    if(new_points < 0) return null;


    try {
        dbUser.set("points", new_points);
        let doc: DBUser = await dbUser.save();
        console.log(`Removed ${amount} Point(s) from user ${member.id} (new pts: ${doc.points})`)
        return doc;
    } catch (e) {
        console.log(`Failed to remove points from user ${member.id}`, e)
        return null;
    }
}

