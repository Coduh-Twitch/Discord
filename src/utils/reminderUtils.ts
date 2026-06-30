import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { reminder_dm_users, reminders } from "../db/schema";
import { client, dev_mode } from "..";

export const createReminder = (
  data: typeof reminders.$inferInsert,
): typeof reminders.$inferInsert => {
  if (data?.id) {
    let reminder = getDbReminder(data.id);
    if (reminder) return reminder;
    return db.insert(reminders).values(data).returning().get();
  }

  return db.insert(reminders).values(data).returning().get();
};

export const getDbReminder = (
  id: string,
): typeof reminders.$inferInsert | null => {
  return db.select().from(reminders).where(eq(reminders.id, id)).get() || null;
};

export const updateDbReminderTimestamp = (
  id: string,
  data: typeof reminders.$inferInsert,
): typeof reminders.$inferInsert => {
  return db
    .update(reminders)
    .set(data)
    .where(eq(reminders.id, id))
    .returning()
    .get();
};

export const addDmUser = (
  reminderId: string,
  userId: string,
): typeof reminder_dm_users.$inferInsert => {
  let dbUser =
    db
      .select()
      .from(reminder_dm_users)
      .where(
        and(
          eq(reminder_dm_users.reminder_id, reminderId),
          eq(reminder_dm_users.user_id, userId),
        ),
      )
      .get() || null;
  if (!dbUser)
    return db
      .insert(reminder_dm_users)
      .values({ user_id: userId, reminder_id: reminderId })
      .returning()
      .get();

  return db
    .update(reminder_dm_users)
    .set({ user_id: userId, reminder_id: reminderId })
    .where(
      and(
        eq(reminder_dm_users.reminder_id, reminderId),
        eq(reminder_dm_users.user_id, userId),
      ),
    )
    .returning()
    .get();
};

export const removeDmUser = (reminderId: string, userId: string): void => {
  let dbUser =
    db
      .select()
      .from(reminder_dm_users)
      .where(
        and(
          eq(reminder_dm_users.reminder_id, reminderId),
          eq(reminder_dm_users.user_id, userId),
        ),
      )
      .get() || null;
  if (!dbUser) return;

  db.delete(reminder_dm_users)
    .where(
      and(
        eq(reminder_dm_users.reminder_id, reminderId),
        eq(reminder_dm_users.user_id, userId),
      ),
    )
    .returning()
    .get();
};

export const getAllDmUsers = (
  reminderId: string,
  filterNotSnoozed: boolean = false,
): (typeof reminder_dm_users.$inferInsert)[] => {
  let arr =
    db
      .select()
      .from(reminder_dm_users)
      .where(eq(reminder_dm_users.reminder_id, reminderId))
      .all() || [];
  if (filterNotSnoozed) {
    return arr.filter((u) => u.snoozed_until <= Date.now());
  } else return arr;
};

export const deleteReminder = (id: string): typeof reminders.$inferInsert => {
  for (const user of getAllDmUsers(id)) {
    unSubscribeUser(user.user_id, id, true);
  }
  return db.delete(reminders).where(eq(reminders.id, id)).returning().get();
};

export const setReminderMessageId = (
  reminderId: string,
  messageId: string,
): typeof reminders.$inferInsert => {
  return db
    .update(reminders)
    .set({ message_id: messageId })
    .where(eq(reminders.id, reminderId))
    .returning()
    .get();
};

export const getAllGuildReminders = (
  id: string,
): (typeof reminders.$inferInsert)[] => {
  return (
    db.select().from(reminders).where(eq(reminders.guild_id, id)).all() || []
  );
};

export const getAllUserReminders = (
  id: string,
): (typeof reminders.$inferInsert)[] => {
  let dmUsers =
    db
      .select()
      .from(reminder_dm_users)
      .where(eq(reminder_dm_users.user_id, id))
      .all() || [];
  let toReturn = [];

  for (const user of dmUsers) {
    toReturn = [
      ...toReturn,
      ...db
        .select()
        .from(reminders)
        .where(eq(reminders.id, user.reminder_id))
        .all(),
    ];
  }

  return toReturn;
};

export const nextReminderTimestamp = (
  reminder: typeof reminders.$inferInsert,
  override_timestamp: number = 0,
): number => {
  const date = new Date();

  if ((reminder?.interval_weekday || 0) > 0) {
    const weekday = reminder.interval_weekday!;
    const currentWeekday = date.getDay();
    let daysToAdd = weekday - currentWeekday;

    if (daysToAdd <= 0) daysToAdd += 7;

    date.setDate(date.getDate() + daysToAdd);

    if (dev_mode) {
      date.setUTCHours(4, 0, 0, 0);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }

  if (reminder.interval_months)
    date.setMonth(date.getMonth() + reminder.interval_months);
  if (reminder.interval_days)
    date.setDate(date.getDate() + reminder.interval_days);
  if (reminder.interval_hours)
    date.setHours(date.getHours() + reminder.interval_hours);
  if (reminder.interval_minutes)
    date.setMinutes(date.getMinutes() + reminder.interval_minutes);

  const finalTimestamp = override_timestamp
    ? override_timestamp
    : date.getTime();

  if (reminder.id) {
    const dbReminder = getDbReminder(reminder.id);
    if (dbReminder) {
      db.update(reminders)
        .set({ next_send_timestamp: finalTimestamp })
        .where(eq(reminders.id, dbReminder.id))
        .returning()
        .get();
    }
  }

  return finalTimestamp;
};

export const subscribeUser = async (
  id: string,
  reminderId: string,
): Promise<void> => {
  addDmUser(reminderId, id);
  let reminder = getDbReminder(reminderId);
  let user = await client.users.fetch(id);

  client.emit("reminderDmSubscriptionAdded", user, reminder);
};

export const unSubscribeUser = async (
  id: string,
  reminderId: string,
  deleted: boolean = false,
): Promise<void> => {
  removeDmUser(reminderId, id);
  let reminder = getDbReminder(reminderId);
  let user = await client.users.fetch(id);

  client.emit("reminderDmSubscriptionRemoved", user, reminder, deleted);
};
