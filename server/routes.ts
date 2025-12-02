import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertDealSchema, insertTaskSchema, insertMeetingSchema, insertNotificationSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { sendMeetingInvite } from "./email";

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

  // ===== MEETING ROUTES =====
  
  app.get("/api/meetings", requireAuth, async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", requireAuth, async (req, res) => {
    try {
      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  // Create meeting (CEO only)
  app.post("/api/meetings", requireCEO, async (req, res) => {
    try {
      // Extract email formatting fields before validation (they're not in schema)
      const { localDate, localTime, organizerTimezone, ...meetingData } = req.body;
      
      const result = insertMeetingSchema.safeParse(meetingData);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const meeting = await storage.createMeeting(result.data);
      
      // Create notifications for participants
      const currentUser = req.user as any;
      const participantEmails: string[] = [];
      
      if (result.data.participants && Array.isArray(result.data.participants)) {
        // Get all users to match emails to user IDs
        const allUsers = await storage.getAllUsers();
        for (const participantEmail of result.data.participants as string[]) {
          participantEmails.push(participantEmail);
          const participant = allUsers.find(u => u.email === participantEmail);
          if (participant && participant.id !== currentUser.id) {
            await storage.createNotification({
              userId: participant.id,
              title: "New Meeting Scheduled",
              message: `You have been invited to "${result.data.title}" by ${currentUser.name}`,
              type: "info",
              link: `/ceo/dashboard`,
            });
          }
        }
      }
      
      // Send email invites via Resend
      if (participantEmails.length > 0) {
        try {
          const emailResult = await sendMeetingInvite({
            title: result.data.title,
            description: result.data.description || undefined,
            scheduledFor: new Date(result.data.scheduledFor),
            location: result.data.location || undefined,
            attendeeEmails: participantEmails,
            organizerName: currentUser.name,
            localDate,
            localTime,
            organizerTimezone,
          });
          
          if (!emailResult.success) {
            console.warn('Meeting created but email failed:', emailResult.error);
          }
        } catch (emailError) {
          console.warn('Meeting created but email service error:', emailError);
        }
      }
      
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  // Update meeting (CEO only)
  app.patch("/api/meetings/:id", requireCEO, async (req, res) => {
    try {
      const result = insertMeetingSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const meeting = await storage.updateMeeting(req.params.id, result.data);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  // Delete meeting (CEO only)
  app.delete("/api/meetings/:id", requireCEO, async (req, res) => {
    try {
      await storage.deleteMeeting(req.params.id);
      res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const notifications = await storage.getNotificationsByUser(currentUser.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // ===== USER PREFERENCES ROUTE =====
  
  app.patch("/api/users/:id/preferences", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      // Users can only update their own preferences
      if (currentUser.id !== req.params.id && currentUser.role !== 'CEO') {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.updateUserPreferences(req.params.id, req.body);
      res.json({ message: "Preferences updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // ===== USER PROFILE ROUTES =====
  
  app.patch("/api/users/:id/profile", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      // Users can only update their own profile
      if (currentUser.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { name, email, phone } = req.body;
      const updates: { name?: string; email?: string; phone?: string } = {};
      
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      
      const updatedUser = await storage.updateUserProfile(req.params.id, updates);
      res.json(updatedUser);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.patch("/api/users/:id/password", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      // Users can only change their own password
      if (currentUser.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      
      // Verify current password
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      await storage.updateUserPassword(req.params.id, newPassword);
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // ===== MARKET DATA ROUTE =====
  
  app.get("/api/market-data", requireAuth, async (req, res) => {
    try {
      const finnhubKey = process.env.FINNHUB_API_KEY;
      
      if (finnhubKey) {
        // Fetch real data from Finnhub
        const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY'];
        const quotes = await Promise.all(
          symbols.map(async (symbol) => {
            try {
              const response = await fetch(
                `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`
              );
              const data = await response.json();
              return {
                symbol,
                name: getSymbolName(symbol),
                description: getSymbolDescription(symbol),
                currentPrice: data.c,
                change: data.d,
                changePercent: data.dp,
                high: data.h,
                low: data.l,
                open: data.o,
                previousClose: data.pc,
              };
            } catch (err) {
              return null;
            }
          })
        );
        
        const validQuotes = quotes.filter((q): q is NonNullable<typeof q> => q !== null && q.currentPrice > 0);
        
        if (validQuotes.length > 0) {
          const marketData = validQuotes.map(q => ({
            name: q!.name,
            symbol: q!.symbol,
            value: q!.currentPrice < 100 
              ? `$${q!.currentPrice.toFixed(2)}` 
              : `$${q!.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: `${q!.changePercent >= 0 ? '+' : ''}${q!.changePercent.toFixed(2)}%`,
            trend: q!.changePercent >= 0 ? 'up' : 'down',
            description: q!.description,
          }));
          
          return res.json({ source: 'live', data: marketData });
        }
      }
      
      // Fallback to simulated data
      const baseData = [
        { name: 'S&P 500', symbol: 'SPY', baseValue: 4567.89, description: 'US Large Cap' },
        { name: 'NASDAQ', symbol: 'QQQ', baseValue: 15234.56, description: 'Tech Heavy' },
        { name: 'Dow Jones', symbol: 'DIA', baseValue: 35678.90, description: 'Blue Chips' },
        { name: 'Apple', symbol: 'AAPL', baseValue: 178.50, description: 'Tech Giant' },
        { name: 'Microsoft', symbol: 'MSFT', baseValue: 378.20, description: 'Enterprise Tech' },
        { name: 'Tesla', symbol: 'TSLA', baseValue: 245.60, description: 'EV Leader' },
      ];
      
      const simulatedData = baseData.map(item => {
        const changePercent = (Math.random() - 0.5) * 4;
        const newValue = item.baseValue * (1 + changePercent / 100);
        
        return {
          name: item.name,
          symbol: item.symbol,
          value: newValue < 100 
            ? `$${newValue.toFixed(2)}` 
            : `$${newValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
          trend: changePercent >= 0 ? 'up' : 'down',
          description: item.description,
        };
      });
      
      res.json({ source: 'simulated', data: simulatedData });
    } catch (error) {
      console.error('Market data error:', error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  return httpServer;
}

function getSymbolName(symbol: string): string {
  const names: Record<string, string> = {
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet',
    'MSFT': 'Microsoft',
    'AMZN': 'Amazon',
    'TSLA': 'Tesla',
    'SPY': 'S&P 500 ETF',
    'QQQ': 'NASDAQ ETF',
    'DIA': 'Dow Jones ETF',
  };
  return names[symbol] || symbol;
}

function getSymbolDescription(symbol: string): string {
  const descriptions: Record<string, string> = {
    'AAPL': 'Tech Giant',
    'GOOGL': 'Search & Cloud',
    'MSFT': 'Enterprise Tech',
    'AMZN': 'E-commerce',
    'TSLA': 'EV Leader',
    'SPY': 'US Large Cap',
    'QQQ': 'Tech Heavy',
    'DIA': 'Blue Chips',
  };
  return descriptions[symbol] || '';
}
