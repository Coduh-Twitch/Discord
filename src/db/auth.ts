import { eq } from "drizzle-orm";
import { db } from ".";
import { authorizations } from "./schema";

export const getAuth = (userId: string): typeof authorizations.$inferInsert | null => {
  return db.select().from(authorizations).where(eq(authorizations.userId, userId)).get() || null;
}

export const ensureAuth = (data: typeof authorizations.$inferInsert): typeof authorizations.$inferInsert => {
  const existing = getAuth(data.userId);
  if (existing) return db.update(authorizations).set(data).where(eq(authorizations.userId, data.userId)).returning().get();

  return db.insert(authorizations).values(data).returning().get();
}
