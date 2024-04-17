import {sql} from 'drizzle-orm';
import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email')
    .unique()
    .notNull(),
});

export const posts = sqliteTable('topics', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, {onDelete: 'cascade'}),
  title: text('title').notNull(),
  /* 
    questionsAndAnswers = [
        { question: 'What is the capital of France?', answer: 'Paris' },
        { question: 'What is the largest planet in our solar system?', answer: 'Jupiter' },
        // ... more question-answer objects
    ];
  */
  questionsAndAnswers: text('questions_and_answers').notNull(),
  createdAt: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export type InsertPost = typeof posts.$inferInsert;
export type SelectPost = typeof posts.$inferSelect;
