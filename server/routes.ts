import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertDealSchema, insertTaskSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "osreaper-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
    })
  );

  // Passport configuration
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Helper to sanitize user data (remove password)
  const sanitizeUser = (user: any) => {
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  };

  // Middleware to check authentication
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: "Unauthorized" });
  };

  // Middleware to check CEO role
  const requireCEO = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user?.role === 'CEO') {
      return next();
    }
    res.status(403).json({ error: "Access denied. CEO role required." });
  };

  // ===== AUTH ROUTES =====
  
  // Sign up
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }

      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser(result.data);
      
      // Auto-login after signup
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Error logging in after signup" });
        }
        res.json(sanitizeUser(user));
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login error" });
        }
        res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout error" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(sanitizeUser(req.user));
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // ===== USER ROUTES =====
  
  // Get all users (CEO only can see all, employees see limited view)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(user => sanitizeUser(user));
      
      // CEO can see all user details
      if (currentUser.role === 'CEO') {
        res.json(sanitizedUsers);
      } else {
        // Employees see limited user info (for task assignment display)
        const limitedUsers = sanitizedUsers.map((u: any) => ({
          id: u.id,
          name: u.name,
          role: u.role,
        }));
        res.json(limitedUsers);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // CEO can see anyone, employees can only see themselves
      if (currentUser.role !== 'CEO' && currentUser.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ===== DEAL ROUTES =====
  
  app.get("/api/deals", requireAuth, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  // Create deal (CEO only)
  app.post("/api/deals", requireCEO, async (req, res) => {
    try {
      const result = insertDealSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const deal = await storage.createDeal(result.data);
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  // Update deal (CEO only)
  app.patch("/api/deals/:id", requireCEO, async (req, res) => {
    try {
      const result = insertDealSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const deal = await storage.updateDeal(req.params.id, result.data);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  // Delete deal (CEO only)
  app.delete("/api/deals/:id", requireCEO, async (req, res) => {
    try {
      await storage.deleteDeal(req.params.id);
      res.json({ message: "Deal deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // ===== TASK ROUTES =====
  
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const { userId, dealId } = req.query;
      let tasks;
      if (userId) {
        tasks = await storage.getTasksByUser(userId as string);
      } else if (dealId) {
        tasks = await storage.getTasksByDeal(dealId as string);
      } else {
        tasks = await storage.getAllTasks();
      }
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Create task (CEO only)
  app.post("/api/tasks", requireCEO, async (req, res) => {
    try {
      const result = insertTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const task = await storage.createTask(result.data);
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task (CEO can update any, employees can only update their own task status)
  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const existingTask = await storage.getTask(req.params.id);
      
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Employees can only update their own tasks and only the status field
      if (currentUser.role !== 'CEO') {
        if (existingTask.assignedTo !== currentUser.id) {
          return res.status(403).json({ error: "You can only update your own tasks" });
        }
        // Employees can only change status
        const allowedFields = ['status'];
        const attemptedFields = Object.keys(req.body);
        const hasDisallowedFields = attemptedFields.some(f => !allowedFields.includes(f));
        if (hasDisallowedFields) {
          return res.status(403).json({ error: "You can only update task status" });
        }
      }
      
      const result = insertTaskSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      
      const task = await storage.updateTask(req.params.id, result.data);
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Delete task (CEO only)
  app.delete("/api/tasks/:id", requireCEO, async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  return httpServer;
}
