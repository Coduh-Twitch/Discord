import { Guild, GuildMember, MessageFlags, TextChannel, User } from "discord.js"
import config from "../config"
import { DBUser, userModel } from "../models/user"
import { TMComponentBuilder } from "../classes/ComponentBuilder"
import { avg, dev_mode } from ".."

export const calculateGivenXP = (message_content: string, is_sub: boolean = false): number => {
    let amt: number = 0;
    if (message_content.length < 10) { amt = Math.floor(Math.random() * 10); return amt } else { amt = Math.round(((Math.random() * 3) + 1) * 6) }

    if (is_sub) amt = amt * config.xp_multipliers.sub;
    amt = Math.round(amt * config.xp_multipliers.base);
    console.log(`Giving ${amt} XP [SUBSCRIBER? ${is_sub}]`)
    return amt;
}

export const calculateRequiredXP = (new_level: number): number => {
    if (dev_mode) return 1000 * new_level;
    if (new_level === 1) {
        return Math.round((new_level * 1000) * 1.1)
    } else if (new_level === 10) {
        return Math.round((new_level * 1000) * 3)
    } else {
        return Math.round((new_level * 1000) * parseFloat(`2.${new_level}`))
    }

}

export const canLevelUp = (current_level: number, xp: number): boolean => {
    let required = calculateRequiredXP(current_level + 1);
    if (xp >= required) {
        return true;
    } else return false;
}

export const canLevelDown = (current_level: number, xp: number): boolean => {
    let required = calculateRequiredXP(current_level - 1);
    if (xp < required) {
        return true;
    } else return false;
}

export const giveRole = (new_level: number, member: GuildMember): GuildMember => {
    const role = member.guild.roles.cache.get(config.roles.levels[new_level.toString()]);
    if (!role) return null;
    if (member.roles.cache.has(role.id)) return null;
    const old_role = member.guild.roles.cache.get(config.roles.levels[(new_level - 1).toString()]);


    try {
        if (old_role) member.roles.remove(old_role.id)
        member.roles.add(role.id);
        return member;
    } catch (e) {
        console.log(`Failed to add level role to member ${member.id}`, e)
        return null;
    }
}

export const giveDownRole = (new_level: number, member: GuildMember): GuildMember => {
    const role = member.guild.roles.cache.get(config.roles.levels[new_level.toString()]);
    if (!role) return null;
    if (member.roles.cache.has(role.id)) return null;
    const old_role = member.guild.roles.cache.get(config.roles.levels[(new_level + 1).toString()]);


    try {
        if (old_role) member.roles.remove(old_role.id)
        member.roles.add(role.id);
        return member;
    } catch (e) {
        console.log(`Failed to add level role to member ${member.id}`, e)
        return null;
    }
}

export const levelUp = async (member: GuildMember, current_level: number): Promise<DBUser> => {
    try {
        let dbUser = await userModel.findOne({ id: member.id });
        let new_level = current_level + 1;

        if(new_level <= Object.values(config.roles.levels).length) giveRole(new_level, member)
        dbUser.set("level", new_level)
        let doc = await dbUser.save();
        await sendLevelUpMessage(member);
        console.log(`Leveled up user ${member.id} to ${new_level}`)
        return doc;
    } catch (e) {
        console.log(e);
        return null;
    }

}

export const levelDown = async (member: GuildMember, current_level: number): Promise<DBUser> => {
    try {
        let dbUser = await userModel.findOne({ id: member.id });
        let new_level = current_level - 1;

        giveDownRole(new_level, member)
        dbUser.set("level", new_level)
        let doc = await dbUser.save();
        console.log(`Leveled down user ${member.id} to ${new_level}`)
        return doc;
    } catch (e) {
        return null;
    }

}

export const addXP = async (member: GuildMember, content: string): Promise<DBUser> => {
    let dbUser = await userModel.findOne({ id: member.id });
    if (!dbUser) {
        const newUser = new userModel({
            id: member.id,
            lastMessageTimestamp: Date.now(),
            level: 0,
            xp: 0,
            shownWelcomeMessage: true
        })

        try {
            const doc = await newUser.save();
            dbUser = doc;
        } catch (e) {
            dbUser = null;
            console.log(`Failed to create new user doc for ${member.id}`, e)
        }
    }
    if (!dbUser === null) return null;
    let current_xp = dbUser.xp;
    let xp_to_give = calculateGivenXP(content, member.roles.cache.has(config.roles.twitch_subscriber));
    let new_xp = current_xp + xp_to_give;


    try {
        dbUser.set("xp", new_xp);
        let doc: DBUser = await dbUser.save();
        if (canLevelUp(doc.level, doc.xp)) doc = await levelUp(member, doc.level)
        console.log(`Added ${xp_to_give} XP to user ${member.id} (new xp: ${doc.xp} lvl ${doc.level})`)
        return doc;
    } catch (e) {
        console.log(`Failed to add xp to user ${member.id}`, e)
        return null;
    }
}

export const removeXP = async (member: GuildMember, amount: number): Promise<DBUser> => {
    let dbUser = await userModel.findOne({ id: member.id });
    if (!dbUser) {
        const newUser = new userModel({
            id: member.id,
            lastMessageTimestamp: Date.now(),
            level: 0,
            xp: 0,
            shownWelcomeMessage: true
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
    let current_xp = dbUser.xp;
    
    let new_xp = current_xp - amount;


    try {
        dbUser.set("xp", new_xp);
        let doc: DBUser = await dbUser.save();
        if (canLevelDown(doc.level, doc.xp)) doc = await levelDown(member, doc.level)
        console.log(`Removed ${amount} XP from user ${member.id} (new xp: ${doc.xp} lvl ${doc.level})`)
        return doc;
    } catch (e) {
        console.log(`Failed to remove xp from user ${member.id}`, e)
        return null;
    }
}

export const sendLevelUpMessage = async (member: GuildMember): Promise<void> => {
    const channel: TextChannel = member.guild.channels.cache.get(config.channels.hangout) as TextChannel;
    let dbUser = await userModel.findOne({ id: member.id })
    const con = new TMComponentBuilder();
    try {
        con.setAccentColor(await avg(member.displayAvatarURL()))
    } catch (e) {
        con.setAccentColor(config.brand_color)
    }
    const levelRole = member.guild.roles.cache.get(config.roles.levels[dbUser.level.toString()])
    const levelPerk = config.level_perks[dbUser.level.toString()];
    console.log(typeof levelPerk)

    let allDbUsers = await userModel.find({id: {$ne: null}});
    allDbUsers = allDbUsers.sort((a, b) => b.xp - a.xp)

    console.log(allDbUsers)

    let rank = allDbUsers.some(u => u.id === dbUser.id) ? allDbUsers.indexOf(allDbUsers.find(u => u.id === dbUser.id)) + 1 : allDbUsers.length;
    let rankEmoji = "";

    if(rank === 1) rankEmoji = " 🥇"
    if(rank === 2) rankEmoji = " 🥈"
    if(rank === 3) rankEmoji = " 🥉"

    con.addTextDisplay(`## ${config.emojis.dance} <@${member.id}> Leveled Up!\nLevel ~~${dbUser.level - 1}~~ -> **${dbUser.level}** (Rank **#${rank}**${rankEmoji})${dbUser.level <= Object.values(config.roles.levels).length ? `\n\n**${member.user.username} unlocked the __${levelRole.name}__ role${levelPerk ? (typeof levelPerk === "object") ? `, and a choice between: ${(levelPerk as string[]).map(s => s).join(" or ")}` : (typeof levelPerk === "string") ? `, and ${levelPerk}` : "" : ""}!**` : ""}`)

    await channel.send({ flags: [MessageFlags.IsComponentsV2], components: [con.buildContainer()] })
    return;
}

