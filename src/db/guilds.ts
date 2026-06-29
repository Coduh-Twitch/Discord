import { and, eq } from "drizzle-orm";
import { db } from ".";
import { answers, guilds, questions, voters } from "./schema";
import { client } from "..";
import config from "../config";
import { TextChannel } from "discord.js";

export const getDbGuild = (id: string): typeof guilds.$inferSelect => {
  let guild = db.select().from(guilds).where(eq(guilds.id, id)).get() || null;
  if (!guild) return db.insert(guilds).values({ id }).returning().get();

  return guild;
};

export const incrementDailyQuestionCount = (
  id: string,
): typeof guilds.$inferInsert => {
  let guild = getDbGuild(id);
  return db
    .update(guilds)
    .set({
      total_daily_questions: guild.total_daily_questions + 1,
      last_daily_question: Date.now(),
    })
    .where(eq(guilds.id, guild.id))
    .returning()
    .get();
};

export const decrementDailyQuestionCount = (
  id: string,
): typeof guilds.$inferInsert => {
  let guild = getDbGuild(id);
  let decremented = guild.total_daily_questions - 1;
  return db
    .update(guilds)
    .set({ total_daily_questions: decremented >= 0 ? decremented : 0 })
    .where(eq(guilds.id, guild.id))
    .returning()
    .get();
};

export const getDailyQuestion = (
  guildId: string,
): {
  question: typeof questions.$inferInsert;
  answers: (typeof answers.$inferInsert)[];
} | null => {
  let question =
    db.select().from(questions).where(eq(questions.guild_id, guildId)).get() ||
    null;
  if (!question) return null;

  let answersArr =
    db
      .select()
      .from(answers)
      .where(eq(answers.question_id, question.id))
      .all() || [];

  return {
    question,
    answers: answersArr,
  };
};

export const newDailyQuestion = (
  guildId: string,
  questionData: typeof questions.$inferInsert,
  answerData: (typeof answers.$inferInsert)[],
): {
  question: typeof questions.$inferInsert;
  answers: (typeof answers.$inferInsert)[];
} => {
  let answersArr = [];
  let currentQuestion =
    db.select().from(questions).where(eq(questions.guild_id, guildId)).get() ||
    null;

  if (currentQuestion) {
    db.delete(voters)
      .where(eq(voters.question_id, currentQuestion.id))
      .returning()
      .get();
    db.delete(answers)
      .where(eq(answers.question_id, currentQuestion.id))
      .returning()
      .all();
    db.delete(questions)
      .where(eq(questions.id, currentQuestion.id))
      .returning()
      .get();
  }

  let question = db.insert(questions).values(questionData).returning().get();

  for (const answer of answerData) {
    let an = db
      .insert(answers)
      .values({ ...answer, question_id: question.id })
      .returning()
      .get();
    answersArr.push(an);
  }

  return {
    question,
    answers: answersArr,
  };
};

export const setDailyQuestionMessageId = (
  questionId: string,
  messageId: string | null,
): typeof questions.$inferInsert => {
  return db
    .update(questions)
    .set({ message_id: messageId })
    .where(eq(questions.id, questionId))
    .returning()
    .get();
};

export const setDailyQuestionPromptId = (
  questionId: string,
  messageId: string | null,
): typeof questions.$inferInsert => {
  return db
    .update(questions)
    .set({ prompt_id: messageId })
    .where(eq(questions.id, questionId))
    .returning()
    .get();
};

export const getAllVoters = (
  questionId: string,
): (typeof voters.$inferInsert)[] => {
  return (
    db.select().from(voters).where(eq(voters.question_id, questionId)).all() ||
    []
  );
};

export const deleteDailyQuestion = async (guildId: string): Promise<void> => {
  let dailyQuestion = getDailyQuestion(guildId);
  if (dailyQuestion) {
    expireDailyQuestion(guildId);
    let guild = await client.guilds.fetch(guildId);
    if (guild) {
      let dbGuild = getDbGuild(guildId);
      let questionChannel = guild.channels.cache.get(
        dbGuild.question_channel_id,
      );
      let promptChannel = guild.channels.cache.get(
        dbGuild.discussion_channel_id,
      );

      let questionMessage = await (
        questionChannel as TextChannel
      ).messages.fetch(dailyQuestion.question.message_id);
      let promptMessage = await (promptChannel as TextChannel).messages.fetch(
        dailyQuestion.question.prompt_id,
      );

      if (questionMessage && questionMessage.deletable) {
        questionMessage
          .delete()
          .then(() => {
            setDailyQuestionMessageId(dailyQuestion.question.id, null);
            if (promptMessage && promptMessage.deletable) {
              promptMessage
                .delete()
                .then(() => {
                  setDailyQuestionPromptId(dailyQuestion.question.id, null);

                  expireDailyQuestion(guildId);
                  decrementDailyQuestionCount(guildId);
                })
                .catch(() => {
                  // oops
                });
            }
          })
          .catch(() => {
            // oops
          });
      }
    }
  }
};

export const expireDailyQuestion = (
  guildId: string,
): typeof questions.$inferInsert => {
  return db
    .update(questions)
    .set({ active: false })
    .where(eq(questions.guild_id, guildId))
    .returning()
    .get();
};

export const addVoter = (
  guildId: string,
  userId: string,
  answerIndex: number,
): typeof voters.$inferInsert => {
  let dailyQuestion = getDailyQuestion(guildId);
  let existingVoter =
    db.select().from(voters).where(eq(voters.user_id, userId)).get() || null;
  if (!existingVoter) {
    let chosenDbAnswer = dailyQuestion.answers.find(
      (a) => a.index === answerIndex,
    );

    db.update(answers)
      .set({ votes: chosenDbAnswer.votes + 1 })
      .where(
        and(
          eq(answers.question_id, dailyQuestion.question.id),
          eq(answers.index, chosenDbAnswer.index),
        ),
      )
      .returning()
      .get();

    return db
      .insert(voters)
      .values({
        guild_id: guildId,
        question_id: dailyQuestion.question.id,
        user_id: userId,
        vote_index: answerIndex,
      })
      .returning()
      .get();
  } else {
    let existingDbAnswer = dailyQuestion.answers.find(
      (a) => a.index === existingVoter.vote_index,
    );
    db.update(answers)
      .set({ votes: existingDbAnswer.votes - 1 })
      .where(
        and(
          eq(answers.question_id, dailyQuestion.question.id),
          eq(answers.index, existingDbAnswer.index),
        ),
      )
      .returning()
      .get();

    let chosenDbAnswer = dailyQuestion.answers.find(
      (a) => a.index === answerIndex,
    );

    db.update(answers)
      .set({ votes: chosenDbAnswer.votes + 1 })
      .where(
        and(
          eq(answers.question_id, dailyQuestion.question.id),
          eq(answers.index, chosenDbAnswer.index),
        ),
      )
      .returning()
      .get();

    return db
      .update(voters)
      .set({ vote_index: answerIndex, question_id: dailyQuestion.question.id })
      .where(and(eq(voters.guild_id, guildId), eq(voters.user_id, userId)))
      .returning()
      .get();
  }
};
