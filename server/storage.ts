import { eq, and } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import type { User, InsertUser, Deal, InsertDeal, Task, InsertTask } from "@shared/schema";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserScore(id: string, score: number): Promise<void>;
  updateUserStats(id: string, activeDeals: number, completedTasks: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Deal operations
  getDeal(id: string): Promise<Deal | undefined>;
  getAllDeals(): Promise<Deal[]>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<void>;
  
  // Task operations
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  getTasksByUser(userId: string): Promise<Task[]>;
  getTasksByDeal(dealId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(schema.users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUserScore(id: string, score: number): Promise<void> {
    await db.update(schema.users)
      .set({ score })
      .where(eq(schema.users.id, id));
  }

  async updateUserStats(id: string, activeDeals: number, completedTasks: number): Promise<void> {
    await db.update(schema.users)
      .set({ activeDeals, completedTasks })
      .where(eq(schema.users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  // Deal operations
  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id));
    return deal;
  }

  async getAllDeals(): Promise<Deal[]> {
    return await db.select().from(schema.deals);
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await db.insert(schema.deals)
      .values(insertDeal)
      .returning();
    return deal;
  }

  async updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [deal] = await db.update(schema.deals)
      .set(updates)
      .where(eq(schema.deals.id, id))
      .returning();
    return deal;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(schema.deals).where(eq(schema.deals.id, id));
  }

  // Task operations
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(schema.tasks);
  }

  async getTasksByUser(userId: string): Promise<Task[]> {
    return await db.select().from(schema.tasks).where(eq(schema.tasks.assignedTo, userId));
  }

  async getTasksByDeal(dealId: string): Promise<Task[]> {
    return await db.select().from(schema.tasks).where(eq(schema.tasks.dealId, dealId));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(schema.tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(schema.tasks)
      .set(updates)
      .where(eq(schema.tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  }
}

export const storage = new DatabaseStorage();
