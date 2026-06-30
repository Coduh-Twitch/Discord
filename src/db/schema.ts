import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import config from "../config";
import { randomUUID } from "node:crypto";

export const guilds = sqliteTable("guilds", {
  id: text("id").notNull().primaryKey(),
  last_daily_question: integer("last_daily_question")
    .notNull()
    .$defaultFn(() => Date.now()),
  total_daily_questions: integer("total_daily_questions").notNull().default(0),
  question_channel_id: text("question_channel_id")
    .notNull()
    .default(config.channels.daily_questions),
  discussion_channel_id: text("discussion_channel_id")
    .notNull()
    .default(config.channels.hangout),
});

export const questions = sqliteTable("questions", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  guild_id: text("guild_id").notNull(),
  message_id: text("message_id"),
  prompt_id: text("prompt_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  expires_at: integer("expires_at").notNull(),
  question_text: text("question_text").notNull(),
  mode: text("mode").notNull(),
});

export const answers = sqliteTable("answers", {
  question_id: text("question_id")
    .notNull()
    .references(() => questions.id),
  answer_text: text("answer_text").notNull(),
  votes: integer("votes").notNull().default(0),
  index: integer("index").notNull(),
});

export const voters = sqliteTable("voters", {
  guild_id: text("guild_id").notNull(),
  question_id: text("question_id")
    .notNull()
    .references(() => questions.id),
  user_id: text("user_id").primaryKey().notNull(),
  vote_index: integer("vote_index"),
});

export const reminders = sqliteTable("reminders", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  guild_id: text("guild_id").notNull(),
  message_id: text("message_id"),
  content: text("content").notNull(),
  next_send_timestamp: integer("next_send_timestamp").notNull().default(0), // timestamp; 0 = disabled
  interval_weekday: integer("interval_weekday").notNull().default(0), // day of the week; 1-7; 0 = disabled
  interval_months: integer("interval_months").notNull().default(0), // amount of months; 0 = disabled
  interval_days: integer("interval_days").notNull().default(0), // amount of days; 0 = disabled
  interval_hours: integer("interval_hours").notNull().default(0), // amount of hours; 0 = disabled
  interval_minutes: integer("interval_minutes").notNull().default(0), // amount of minutes; 0 = disabled
});

export const reminder_dm_users = sqliteTable("reminder_dm_users", {
  reminder_id: text("reminder_id")
    .notNull()
    .references(() => reminders.id),
  user_id: text("user_id").notNull(),
  snoozed_until: integer("snoozed_until").notNull().default(0), // timestamp; 0 = disabled
});
