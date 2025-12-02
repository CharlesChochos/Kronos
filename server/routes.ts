import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertDealSchema, insertTaskSchema, insertMeetingSchema, insertNotificationSchema, insertAssistantConversationSchema, insertAssistantMessageSchema, insertTimeEntrySchema, insertTimeOffRequestSchema, insertAuditLogSchema, insertInvestorSchema, insertInvestorInteractionSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { sendMeetingInvite, sendPasswordResetEmail } from "./email";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import multer from "multer";

// Initialize OpenAI client with Replit AI Integrations
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

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
        return res.status(400).json({ error: "Email already registered. Please sign in instead." });
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

  // Forgot Password - Request Reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration attacks
      if (!user) {
        return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store the token
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Generate reset link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send the email
      console.log('Attempting to send password reset email to:', user.email);
      console.log('Reset link:', resetLink);
      
      const emailResult = await sendPasswordResetEmail({
        email: user.email,
        userName: user.name,
        resetLink,
      });

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        console.error('Email config details - User:', user.email, 'Name:', user.name);
      } else {
        console.log('Password reset email sent successfully to:', user.email);
      }

      res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Reset Password - Verify Token and Update Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }

      // Find valid token
      const resetToken = await storage.getValidPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset token. Please request a new password reset." });
      }

      // Update the user's password
      await storage.updateUserPassword(resetToken.userId, newPassword);

      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Verify Reset Token (for frontend validation)
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ valid: false, error: "Token is required" });
      }

      const resetToken = await storage.getValidPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ valid: false, error: "Invalid or expired token" });
      }

      res.json({ valid: true });
    } catch (error) {
      res.status(500).json({ valid: false, error: "Failed to verify token" });
    }
  });

  // ===== FILE UPLOAD ROUTES =====
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure multer for file uploads
  const fileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      // Generate unique filename with sanitized original name
      const uniqueId = crypto.randomUUID();
      const ext = path.extname(file.originalname).toLowerCase();
      const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 100);
      cb(null, `${uniqueId}-${baseName}${ext}`);
    }
  });

  const upload = multer({
    storage: fileStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (_req, file, cb) => {
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV'));
      }
    }
  });

  // Serve uploaded files statically (with path traversal protection)
  app.use("/uploads", (req, res, next) => {
    const requestedPath = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(uploadsDir, requestedPath);
    
    // Ensure file is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Upload file using multer
  app.post("/api/upload", requireAuth, upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      
      res.json({
        id: crypto.randomUUID(),
        filename: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
        type: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Delete file
  app.delete("/api/upload/:filename", requireAuth, async (req, res) => {
    try {
      const requestedFilename = path.normalize(req.params.filename).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(uploadsDir, requestedFilename);
      
      // Ensure file is within uploads directory
      if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: "File deleted successfully" });
      } else {
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
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
      
      // Employees can only update their own tasks (status, or forward to another user)
      if (currentUser.role !== 'CEO') {
        if (existingTask.assignedTo !== currentUser.id) {
          return res.status(403).json({ error: "You can only update your own tasks" });
        }
        // Employees can change status or forward tasks (assignedTo)
        const allowedFields = ['status', 'assignedTo'];
        const attemptedFields = Object.keys(req.body);
        const hasDisallowedFields = attemptedFields.some(f => !allowedFields.includes(f));
        if (hasDisallowedFields) {
          return res.status(403).json({ error: "You can only update task status or forward tasks" });
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
      
      // Generate video link based on platform
      let videoLink: string | null = null;
      if (meetingData.videoPlatform) {
        const meetingId = crypto.randomUUID().replace(/-/g, '').substring(0, 11);
        switch (meetingData.videoPlatform) {
          case 'zoom':
            videoLink = `https://zoom.us/j/${meetingId}`;
            break;
          case 'google_meet':
            videoLink = `https://meet.google.com/${meetingId.substring(0, 3)}-${meetingId.substring(3, 7)}-${meetingId.substring(7, 11)}`;
            break;
          case 'teams':
            videoLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
            break;
        }
        meetingData.videoLink = videoLink;
      }
      
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
            videoLink: meeting.videoLink || undefined,
            videoPlatform: meeting.videoPlatform || undefined,
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
      
      const { name, email, phone, avatar, role } = req.body;
      const updates: { name?: string; email?: string; phone?: string; avatar?: string; role?: string } = {};
      
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (avatar !== undefined) updates.avatar = avatar;
      
      // Handle role change with validation
      if (role) {
        const validRoles = ['Analyst', 'Associate', 'Director', 'Managing Director', 'CEO', 'Custom'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: "Invalid role" });
        }
        // Prevent escalation to CEO (only existing CEOs can be CEO)
        if (role === 'CEO' && currentUser.role !== 'CEO') {
          return res.status(403).json({ error: "Cannot escalate to CEO role" });
        }
        // Prevent CEO from changing their own role (to prevent lockout)
        if (currentUser.role === 'CEO' && role !== 'CEO') {
          return res.status(403).json({ error: "CEO cannot change their own role" });
        }
        updates.role = role;
      }
      
      // Handle custom job title
      const { jobTitle } = req.body;
      if (jobTitle !== undefined) {
        (updates as any).jobTitle = jobTitle;
      }
      
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

  // ===== AI DOCUMENT GENERATION =====
  
  app.post("/api/generate-document", requireAuth, async (req, res) => {
    try {
      const { templateName, dealData, complianceOptions } = req.body;
      
      if (!templateName) {
        return res.status(400).json({ error: "Template name is required" });
      }
      
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const complianceText = [
        complianceOptions?.sec && 'SEC compliance requirements',
        complianceOptions?.finra && 'FINRA regulatory standards',
        complianceOptions?.legal && 'legal review requirements',
      ].filter(Boolean).join(', ') || 'standard legal compliance';
      
      const dealContext = dealData ? `
Deal Information:
- Project Name: ${dealData.name || 'N/A'}
- Client: ${dealData.client || 'N/A'}
- Sector: ${dealData.sector || 'N/A'}
- Transaction Value: $${dealData.value || 0}M
- Current Stage: ${dealData.stage || 'N/A'}
- Description: ${dealData.description || 'N/A'}
` : 'No specific deal context provided.';

      const prompt = `You are a professional investment banking document generator for OSReaper platform.

Generate a complete, professional ${templateName} document based on the following context:

${dealContext}

Compliance Requirements: ${complianceText}

Requirements:
1. Use formal investment banking language and terminology
2. Include all standard sections appropriate for a ${templateName}
3. Format with clear headers and professional structure
4. Include placeholder fields where specific data is needed [in brackets]
5. Make it ready for executive review
6. Current date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
7. The document should be from "Equiturn Holdings LLC" (the acquiring/investing party)

Generate only the document content, no additional commentary.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert investment banking document specialist who creates professional legal and financial documents." },
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });
      
      const content = response.choices[0]?.message?.content || 'Failed to generate content';
      
      res.json({ content });
    } catch (error: any) {
      console.error('Document generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate document" });
    }
  });

  // ===== AI TASK ANALYSIS =====

  app.post("/api/ai/analyze-task", requireAuth, async (req, res) => {
    try {
      const { task, deal } = req.body;
      
      if (!task) {
        return res.status(400).json({ error: "Task data is required" });
      }
      
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const taskContext = `
Task Information:
- Title: ${task.title || 'N/A'}
- Description: ${task.description || 'No description'}
- Type: ${task.type || 'General'}
- Priority: ${task.priority || 'Medium'}
`;

      const dealContext = deal ? `
Deal Context:
- Name: ${deal.name || 'N/A'}
- Client: ${deal.client || 'N/A'}
- Sector: ${deal.sector || 'N/A'}
- Stage: ${deal.stage || 'N/A'}
` : 'No deal context provided.';

      const prompt = `You are an AI assistant for an investment banking platform. Analyze the following task and suggest the best action to take.

${taskContext}
${dealContext}

Based on this task, provide:
1. A recommended action (1-2 sentences)
2. Brief reasoning for this recommendation (2-3 sentences)
3. List of 2-4 relevant tools/applications the user should use

Respond in JSON format:
{
  "action": "string - the recommended action",
  "reasoning": "string - explanation of why this action is best",
  "tools": ["array", "of", "tool", "names"]
}

Consider common investment banking tasks like:
- Document preparation (Word, Excel, PowerPoint)
- Financial modeling (Excel, specialized tools)
- Due diligence research (web research, databases)
- Client communication (Email, Calendar)
- Data analysis (Excel, BI tools)
- Presentation creation (PowerPoint)
- Legal review (Document management)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert investment banking workflow assistant. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        return res.status(500).json({ error: "Failed to analyze task" });
      }
      
      const analysis = JSON.parse(content);
      res.json(analysis);
    } catch (error: any) {
      console.error('AI task analysis error:', error);
      res.status(500).json({ 
        action: "Manual Review Required",
        reasoning: "Unable to analyze the task automatically at this time.",
        tools: ["Document Editor", "Email Client", "Calendar"]
      });
    }
  });

  // ===== REAPER ASSISTANT ROUTES =====
  
  // Get user's assistant conversations
  app.get("/api/assistant/conversations", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversations = await storage.getAssistantConversationsByUser(currentUser.id);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching assistant conversations:', error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  
  // Create new assistant conversation
  app.post("/api/assistant/conversations", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Validate and sanitize title
      let title = 'New Conversation';
      if (req.body.title && typeof req.body.title === 'string') {
        title = req.body.title.trim().slice(0, 100); // Limit to 100 chars
      }
      
      const conversation = await storage.createAssistantConversation({
        userId: currentUser.id,
        title,
      });
      res.json(conversation);
    } catch (error) {
      console.error('Error creating assistant conversation:', error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  
  // Get messages for a conversation
  app.get("/api/assistant/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversation = await storage.getAssistantConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== currentUser.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const messages = await storage.getAssistantMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching assistant messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  // Send message to Reaper and get AI response
  app.post("/api/assistant/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversation = await storage.getAssistantConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== currentUser.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { content, attachments } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      // Save user message with attachments
      const userMessage = await storage.createAssistantMessage({
        conversationId: req.params.id,
        role: 'user',
        content,
        attachments: attachments || [],
      });
      
      // Gather context for the AI
      const [deals, tasks, users, allTasks] = await Promise.all([
        storage.getAllDeals(),
        storage.getTasksByUser(currentUser.id),
        storage.getAllUsers(),
        storage.getAllTasks(),
      ]);
      
      // Build context about the platform state
      const platformContext = {
        currentUser: { 
          id: currentUser.id, 
          name: currentUser.name, 
          role: currentUser.role,
          activeDeals: currentUser.activeDeals,
          completedTasks: currentUser.completedTasks,
        },
        dealsSummary: {
          total: deals.length,
          active: deals.filter(d => d.status === 'Active').length,
          stages: deals.reduce((acc, d) => {
            acc[d.stage] = (acc[d.stage] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          totalValue: deals.reduce((sum, d) => sum + d.value, 0),
        },
        myTasks: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'Pending').length,
          inProgress: tasks.filter(t => t.status === 'In Progress').length,
          completed: tasks.filter(t => t.status === 'Completed').length,
          overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'Completed').length,
        },
        teamMembers: users.map(u => ({ 
          id: u.id, 
          name: u.name, 
          role: u.role,
          activeDeals: u.activeDeals,
          completedTasks: u.completedTasks,
        })),
        recentDeals: deals.slice(0, 5).map(d => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          value: d.value,
          client: d.client,
          sector: d.sector,
          lead: d.lead,
          progress: d.progress,
          status: d.status,
        })),
        upcomingTasks: tasks
          .filter(t => t.status !== 'Completed')
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: t.dueDate,
            status: t.status,
            type: t.type,
          })),
      };
      
      // Get conversation history for context
      const previousMessages = await storage.getAssistantMessages(req.params.id);
      const conversationHistory = previousMessages
        .filter(m => m.id !== userMessage.id)
        .slice(-10) // Last 10 messages for context
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      
      // Build the system prompt
      const systemPrompt = `You are Reaper, an AI assistant for OSReaper - an investment banking operations platform. You help ${currentUser.role === 'CEO' ? 'executives' : 'team members'} manage deals, tasks, and collaborate with their team.

Your capabilities:
- Answer questions about deals, tasks, and team activities
- Provide insights on deal progress and pipeline status
- Help with task prioritization and workload management
- Offer advice on deal strategies and next steps
- Explain platform features and how to use them
- Summarize team member activities and workloads
- SEND IN-APP MESSAGES to team members (use send_message function)
- SHARE FILES with team members (use share_file function)

IMPORTANT - Sending Messages:
When the user asks you to send a message to someone, you MUST use the send_message function.
Extract the recipient name and the message content from the user's request.
Example: "Send a message to Emily saying hello" -> call send_message with recipientName="Emily" and content="hello"

IMPORTANT - Sharing Files:
When the user uploads a file to this conversation and asks you to share it with someone, use the share_file function.
The file information will be provided in the user's message attachments. Extract the filename and recipient from the request.
Example: "Share this file with Michael" -> call share_file with the uploaded file's details and recipientName="Michael"

Current Platform Context:
${JSON.stringify(platformContext, null, 2)}

Guidelines:
- Be concise but thorough
- Use specific data from the context when relevant
- Format responses with clear structure (use markdown)
- If asked about something not in your context, say so clearly
- Be professional but approachable
- When discussing values, note they are in millions (e.g., $50M)
- Reference team members by name when relevant
- For task and deal queries, provide actionable insights
- When asked to send a message, ALWAYS use the send_message function`;
      
      // Define tools for the assistant
      const tools: any[] = [
        {
          type: "function",
          function: {
            name: "send_message",
            description: "Send an in-app message to a team member. Use this when the user asks to message, contact, or communicate with someone.",
            parameters: {
              type: "object",
              properties: {
                recipientName: {
                  type: "string",
                  description: "The name of the person to send the message to"
                },
                content: {
                  type: "string",
                  description: "The message content to send"
                }
              },
              required: ["recipientName", "content"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "share_file",
            description: "Share a file with a team member. Use this when the user has uploaded a file and asks you to share it with someone.",
            parameters: {
              type: "object",
              properties: {
                recipientName: {
                  type: "string",
                  description: "The name of the person to share the file with"
                },
                fileUrl: {
                  type: "string",
                  description: "The URL of the file to share"
                },
                filename: {
                  type: "string",
                  description: "The name of the file being shared"
                },
                message: {
                  type: "string",
                  description: "Optional message to send along with the file"
                }
              },
              required: ["recipientName", "fileUrl", "filename"]
            }
          }
        }
      ];
      
      // Call OpenAI API with function calling
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content },
          ],
          tools,
          tool_choice: "auto",
          max_completion_tokens: 2048,
        });
        
        const responseMessage = completion.choices[0]?.message;
        let assistantContent = responseMessage?.content || "";
        
        // Handle function calls
        if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
          const toolResults: any[] = [];
          
          for (const toolCall of responseMessage.tool_calls) {
            const functionCall = (toolCall as any).function;
            if (functionCall?.name === "send_message") {
              try {
                const args = JSON.parse(functionCall.arguments);
                
                // Find recipient user
                const allUsers = await storage.getAllUsers();
                const recipient = allUsers.find(u => 
                  u.name.toLowerCase() === args.recipientName.toLowerCase() ||
                  u.name.toLowerCase().includes(args.recipientName.toLowerCase())
                );
                
                if (recipient && recipient.id !== currentUser.id) {
                  // Get or create conversation
                  let conversation = await storage.getConversationBetweenUsers(currentUser.id, recipient.id);
                  
                  if (!conversation) {
                    conversation = await storage.createConversation({
                      name: recipient.name,
                      isGroup: false,
                      createdBy: currentUser.id,
                    });
                    
                    await storage.addConversationMember(conversation.id, currentUser.id);
                    await storage.addConversationMember(conversation.id, recipient.id);
                  }
                  
                  // Send message
                  await storage.createMessage({
                    conversationId: conversation.id,
                    senderId: currentUser.id,
                    content: args.content,
                  });
                  
                  // Create notification
                  await storage.createNotification({
                    userId: recipient.id,
                    title: 'New Message',
                    message: `${currentUser.name}: ${args.content.slice(0, 50)}${args.content.length > 50 ? '...' : ''}`,
                    type: 'info',
                    link: '/chat',
                  });
                  
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `Message sent successfully to ${recipient.name}`
                  });
                } else if (recipient?.id === currentUser.id) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: "Cannot send message to yourself"
                  });
                } else {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `User "${args.recipientName}" not found. Available team members: ${allUsers.filter(u => u.id !== currentUser.id).map(u => u.name).join(', ')}`
                  });
                }
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to parse message parameters"
                });
              }
            } else if (functionCall?.name === "share_file") {
              try {
                const args = JSON.parse(functionCall.arguments);
                
                // Find recipient user
                const allUsers = await storage.getAllUsers();
                const recipient = allUsers.find(u => 
                  u.name.toLowerCase() === args.recipientName.toLowerCase() ||
                  u.name.toLowerCase().includes(args.recipientName.toLowerCase())
                );
                
                if (recipient && recipient.id !== currentUser.id) {
                  // Get or create conversation
                  let conversation = await storage.getConversationBetweenUsers(currentUser.id, recipient.id);
                  
                  if (!conversation) {
                    conversation = await storage.createConversation({
                      name: recipient.name,
                      isGroup: false,
                      createdBy: currentUser.id,
                    });
                    
                    await storage.addConversationMember(conversation.id, currentUser.id);
                    await storage.addConversationMember(conversation.id, recipient.id);
                  }
                  
                  // Build message content with file link
                  const messageContent = args.message 
                    ? `${args.message}\n\n📎 Shared file: ${args.filename}`
                    : `📎 Shared file: ${args.filename}`;
                  
                  // Create attachment object
                  const attachment = {
                    id: crypto.randomUUID(),
                    type: 'file',
                    filename: args.filename,
                    url: args.fileUrl,
                    mimeType: 'application/octet-stream',
                    size: 0,
                    uploadedAt: new Date().toISOString(),
                  };
                  
                  // Send message with file attachment
                  await storage.createMessage({
                    conversationId: conversation.id,
                    senderId: currentUser.id,
                    content: messageContent,
                    attachments: [attachment],
                  });
                  
                  // Create notification
                  await storage.createNotification({
                    userId: recipient.id,
                    title: 'New File Shared',
                    message: `${currentUser.name} shared: ${args.filename}`,
                    type: 'info',
                    link: '/chat',
                  });
                  
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `File "${args.filename}" shared successfully with ${recipient.name}`
                  });
                } else if (recipient?.id === currentUser.id) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: "Cannot share file with yourself"
                  });
                } else {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `User "${args.recipientName}" not found. Available team members: ${allUsers.filter(u => u.id !== currentUser.id).map(u => u.name).join(', ')}`
                  });
                }
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to parse file sharing parameters"
                });
              }
            }
          }
          
          // Get final response after tool execution
          const toolMessages = responseMessage.tool_calls.map((tc, i) => ({
            role: "tool" as const,
            tool_call_id: tc.id,
            content: toolResults[i]?.result || "Function executed"
          }));
          
          const followUpCompletion = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
              { role: "user", content },
              { role: "assistant", content: null, tool_calls: responseMessage.tool_calls },
              ...toolMessages,
            ],
            max_completion_tokens: 2048,
          });
          
          assistantContent = followUpCompletion.choices[0]?.message?.content || "I've completed the action.";
        }
        
        if (!assistantContent) {
          assistantContent = "I apologize, but I couldn't generate a response. Please try again.";
        }
        
        // Save assistant response
        const assistantMessage = await storage.createAssistantMessage({
          conversationId: req.params.id,
          role: 'assistant',
          content: assistantContent,
          context: platformContext as any,
        });
        
        // Update conversation title if it's the first message
        if (previousMessages.length === 0) {
          const titleWords = content.split(' ').slice(0, 5).join(' ');
          const title = titleWords.length > 30 ? titleWords.substring(0, 30) + '...' : titleWords;
          await storage.updateAssistantConversationTitle(req.params.id, title);
        }
        
        res.json({
          userMessage,
          assistantMessage,
        });
      } catch (aiError: any) {
        console.error('OpenAI API error:', aiError);
        
        // Still save a fallback response
        const fallbackMessage = await storage.createAssistantMessage({
          conversationId: req.params.id,
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment.",
        });
        
        res.json({
          userMessage,
          assistantMessage: fallbackMessage,
        });
      }
    } catch (error) {
      console.error('Error in assistant chat:', error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });
  
  // Update conversation title
  app.patch("/api/assistant/conversations/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversation = await storage.getAssistantConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== currentUser.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { title } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const updated = await storage.updateAssistantConversationTitle(req.params.id, title);
      res.json(updated);
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });
  
  // Delete conversation
  app.delete("/api/assistant/conversations/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversation = await storage.getAssistantConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== currentUser.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteAssistantConversation(req.params.id);
      res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // ===== CHAT SYSTEM ROUTES =====
  
  // Get user's conversations
  app.get("/api/chat/conversations", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversations = await storage.getConversationsByUser(currentUser.id);
      
      // Enrich conversations with member details and last message
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const members = await storage.getConversationMembers(conv.id);
          const messages = await storage.getMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          
          const memberDetails = await Promise.all(
            members.map(async (m) => {
              const user = await storage.getUser(m.userId);
              return user ? { id: user.id, name: user.name, avatar: user.avatar } : null;
            })
          );
          
          return {
            ...conv,
            members: memberDetails.filter(Boolean),
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            } : null,
            unreadCount: 0, // Will be calculated client-side or enhanced later
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  
  // Create new conversation or get existing one
  app.post("/api/chat/conversations", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { participantId, isGroup, name, participantIds } = req.body;
      
      if (isGroup) {
        // Create group conversation
        if (!participantIds || participantIds.length < 2) {
          return res.status(400).json({ error: "Group requires at least 2 participants" });
        }
        
        const conversation = await storage.createConversation({
          name: name || 'Group Chat',
          isGroup: true,
          createdBy: currentUser.id,
        });
        
        // Add all members including creator
        await storage.addConversationMember(conversation.id, currentUser.id);
        for (const pid of participantIds) {
          if (pid !== currentUser.id) {
            await storage.addConversationMember(conversation.id, pid);
          }
        }
        
        res.json(conversation);
      } else {
        // Direct message - check if conversation already exists
        if (!participantId) {
          return res.status(400).json({ error: "participantId is required for direct messages" });
        }
        
        let conversation = await storage.getConversationBetweenUsers(currentUser.id, participantId);
        
        if (!conversation) {
          // Create new conversation
          const participant = await storage.getUser(participantId);
          conversation = await storage.createConversation({
            name: participant?.name || 'Direct Message',
            isGroup: false,
            createdBy: currentUser.id,
          });
          
          await storage.addConversationMember(conversation.id, currentUser.id);
          await storage.addConversationMember(conversation.id, participantId);
        }
        
        res.json(conversation);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  
  // Get messages for a conversation
  app.get("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversation = await storage.getConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Verify user is a member
      const members = await storage.getConversationMembers(req.params.id);
      if (!members.some(m => m.userId === currentUser.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const messages = await storage.getMessages(req.params.id);
      
      // Enrich messages with sender details
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId);
          return {
            ...msg,
            senderName: sender?.name || 'Unknown',
            senderAvatar: sender?.avatar,
          };
        })
      );
      
      // Mark as read
      await storage.markMessagesAsRead(req.params.id, currentUser.id);
      
      res.json(enrichedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  // Send message
  app.post("/api/chat/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { content, attachments } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      const conversation = await storage.getConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Verify user is a member
      const members = await storage.getConversationMembers(req.params.id);
      if (!members.some(m => m.userId === currentUser.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const message = await storage.createMessage({
        conversationId: req.params.id,
        senderId: currentUser.id,
        content: content.trim(),
        attachments: attachments || [],
      });
      
      // Create notifications for other members
      for (const member of members) {
        if (member.userId !== currentUser.id) {
          await storage.createNotification({
            userId: member.userId,
            title: 'New Message',
            message: `${currentUser.name}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
            type: 'info',
            link: '/chat',
          });
        }
      }
      
      res.json({
        ...message,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Send message to user by name (for Reaper assistant integration)
  app.post("/api/chat/send-to-user", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { recipientName, content, attachments } = req.body;
      
      if (!recipientName || typeof recipientName !== 'string') {
        return res.status(400).json({ error: "Recipient name is required" });
      }
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      // Find user by name (case insensitive)
      const allUsers = await storage.getAllUsers();
      const recipient = allUsers.find(u => 
        u.name.toLowerCase() === recipientName.toLowerCase() ||
        u.name.toLowerCase().includes(recipientName.toLowerCase())
      );
      
      if (!recipient) {
        return res.status(404).json({ error: `User "${recipientName}" not found` });
      }
      
      if (recipient.id === currentUser.id) {
        return res.status(400).json({ error: "Cannot send message to yourself" });
      }
      
      // Get or create conversation
      let conversation = await storage.getConversationBetweenUsers(currentUser.id, recipient.id);
      
      if (!conversation) {
        conversation = await storage.createConversation({
          name: recipient.name,
          isGroup: false,
          createdBy: currentUser.id,
        });
        
        await storage.addConversationMember(conversation.id, currentUser.id);
        await storage.addConversationMember(conversation.id, recipient.id);
      }
      
      // Send message
      const message = await storage.createMessage({
        conversationId: conversation.id,
        senderId: currentUser.id,
        content: content.trim(),
        attachments: attachments || [],
      });
      
      // Create notification for recipient
      await storage.createNotification({
        userId: recipient.id,
        title: 'New Message',
        message: `${currentUser.name}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
        type: 'info',
        link: '/chat',
      });
      
      res.json({
        success: true,
        message: {
          ...message,
          senderName: currentUser.name,
          recipientName: recipient.name,
        },
        conversationId: conversation.id,
      });
    } catch (error) {
      console.error('Error sending message to user:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // ===== MARKET DATA ROUTE =====
  
  app.get("/api/market-data", requireAuth, async (req, res) => {
    try {
      const finnhubKey = process.env.FINNHUB_API_KEY;
      
      // Accept symbols from query parameter or use defaults
      const requestedSymbols = req.query.symbols 
        ? (req.query.symbols as string).split(',').map(s => s.trim().toUpperCase())
        : ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY'];
      
      if (finnhubKey) {
        // Fetch real data from Finnhub
        const symbols = requestedSymbols;
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
      
      // Fallback to simulated data for requested symbols
      const baseDataMap: Record<string, { name: string, baseValue: number, description: string }> = {
        'SPY': { name: 'S&P 500', baseValue: 4567.89, description: 'US Large Cap' },
        'QQQ': { name: 'NASDAQ', baseValue: 15234.56, description: 'Tech Heavy' },
        'DIA': { name: 'Dow Jones', baseValue: 35678.90, description: 'Blue Chips' },
        'AAPL': { name: 'Apple', baseValue: 178.50, description: 'Tech Giant' },
        'MSFT': { name: 'Microsoft', baseValue: 378.20, description: 'Enterprise Tech' },
        'TSLA': { name: 'Tesla', baseValue: 245.60, description: 'EV Leader' },
        'GOOGL': { name: 'Alphabet', baseValue: 138.25, description: 'Search & Cloud' },
        'AMZN': { name: 'Amazon', baseValue: 185.60, description: 'E-commerce' },
        'NVDA': { name: 'NVIDIA', baseValue: 480.75, description: 'AI & GPUs' },
        'META': { name: 'Meta', baseValue: 505.40, description: 'Social Media' },
        'JPM': { name: 'JPMorgan', baseValue: 195.30, description: 'Banking' },
        'V': { name: 'Visa', baseValue: 267.80, description: 'Payments' },
        'GS': { name: 'Goldman Sachs', baseValue: 385.20, description: 'Investment Bank' },
        'MS': { name: 'Morgan Stanley', baseValue: 95.40, description: 'Investment Bank' },
        'BRK.B': { name: 'Berkshire', baseValue: 365.50, description: 'Conglomerate' },
        'WMT': { name: 'Walmart', baseValue: 165.20, description: 'Retail' },
        'JNJ': { name: 'Johnson & Johnson', baseValue: 158.40, description: 'Healthcare' },
        'PG': { name: 'Procter & Gamble', baseValue: 156.80, description: 'Consumer Goods' },
        'UNH': { name: 'UnitedHealth', baseValue: 525.30, description: 'Healthcare' },
        'XOM': { name: 'Exxon Mobil', baseValue: 105.60, description: 'Energy' },
      };
      
      const simulatedData = requestedSymbols.map(symbol => {
        const baseData = baseDataMap[symbol] || { name: symbol, baseValue: 100 + Math.random() * 400, description: 'Stock' };
        const changePercent = (Math.random() - 0.5) * 4;
        const newValue = baseData.baseValue * (1 + changePercent / 100);
        
        return {
          name: baseData.name,
          symbol: symbol,
          value: newValue < 100 
            ? `$${newValue.toFixed(2)}` 
            : `$${newValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
          trend: changePercent >= 0 ? 'up' : 'down',
          description: baseData.description,
        };
      });
      
      res.json({ source: 'simulated', data: simulatedData });
    } catch (error) {
      console.error('Market data error:', error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // ===== MARKET NEWS ROUTE =====
  
  app.get("/api/market-news", requireAuth, async (req, res) => {
    try {
      const finnhubKey = process.env.FINNHUB_API_KEY;
      const category = (req.query.category as string) || 'general';
      
      if (finnhubKey) {
        // Fetch real news from Finnhub
        const response = await fetch(
          `https://finnhub.io/api/v1/news?category=${category}&token=${finnhubKey}`
        );
        const news = await response.json();
        
        if (Array.isArray(news) && news.length > 0) {
          const formattedNews = news.slice(0, 10).map((item: any) => ({
            id: item.id?.toString() || crypto.randomUUID(),
            headline: item.headline,
            summary: item.summary,
            source: item.source,
            url: item.url,
            image: item.image,
            datetime: new Date(item.datetime * 1000).toISOString(),
            category: item.category,
            related: item.related,
          }));
          
          return res.json({ source: 'live', data: formattedNews });
        }
      }
      
      // Fallback to sample news data
      const sampleNews = [
        {
          id: '1',
          headline: 'Fed Signals Potential Rate Cuts in 2024',
          summary: 'Federal Reserve officials indicated they may begin cutting interest rates next year as inflation continues to cool.',
          source: 'Reuters',
          url: '#',
          datetime: new Date().toISOString(),
          category: 'general',
        },
        {
          id: '2',
          headline: 'Tech Giants Report Strong Q4 Earnings',
          summary: 'Major technology companies exceeded Wall Street expectations with robust quarterly results.',
          source: 'Bloomberg',
          url: '#',
          datetime: new Date(Date.now() - 3600000).toISOString(),
          category: 'technology',
        },
        {
          id: '3',
          headline: 'M&A Activity Surges in Financial Sector',
          summary: 'Investment banks report increased merger and acquisition activity as market conditions improve.',
          source: 'WSJ',
          url: '#',
          datetime: new Date(Date.now() - 7200000).toISOString(),
          category: 'merger',
        },
        {
          id: '4',
          headline: 'Global Markets Rally on Economic Data',
          summary: 'Stock markets worldwide advance as economic indicators point to continued growth.',
          source: 'CNBC',
          url: '#',
          datetime: new Date(Date.now() - 10800000).toISOString(),
          category: 'general',
        },
        {
          id: '5',
          headline: 'IPO Market Shows Signs of Recovery',
          summary: 'Initial public offerings are gaining momentum as investor confidence returns.',
          source: 'Financial Times',
          url: '#',
          datetime: new Date(Date.now() - 14400000).toISOString(),
          category: 'ipo',
        },
      ];
      
      res.json({ source: 'sample', data: sampleNews });
    } catch (error) {
      console.error('Market news error:', error);
      res.status(500).json({ error: "Failed to fetch market news" });
    }
  });

  // ===== TIME TRACKING ROUTES =====
  
  // Get all time entries (CEO sees all, employees see their own)
  app.get("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      let entries;
      if (user.role === 'CEO') {
        entries = await storage.getAllTimeEntries();
      } else {
        entries = await storage.getTimeEntriesByUser(user.id);
      }
      res.json(entries);
    } catch (error) {
      console.error('Get time entries error:', error);
      res.status(500).json({ error: "Failed to fetch time entries" });
    }
  });
  
  // Get time entries for a specific deal
  app.get("/api/time-entries/deal/:dealId", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getTimeEntriesByDeal(req.params.dealId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time entries for deal" });
    }
  });
  
  // Create time entry
  app.post("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertTimeEntrySchema.safeParse({ ...req.body, userId: user.id });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const entry = await storage.createTimeEntry(result.data);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'CREATE',
        entityType: 'TimeEntry',
        entityId: entry.id,
        details: `Logged ${result.data.hours} minutes for ${result.data.category}`,
      });
      
      res.status(201).json(entry);
    } catch (error) {
      console.error('Create time entry error:', error);
      res.status(500).json({ error: "Failed to create time entry" });
    }
  });
  
  // Update time entry
  app.patch("/api/time-entries/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      if (entry.userId !== user.id && user.role !== 'CEO') {
        return res.status(403).json({ error: "Not authorized to update this entry" });
      }
      
      const updated = await storage.updateTimeEntry(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update time entry" });
    }
  });
  
  // Delete time entry
  app.delete("/api/time-entries/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      if (entry.userId !== user.id && user.role !== 'CEO') {
        return res.status(403).json({ error: "Not authorized to delete this entry" });
      }
      
      await storage.deleteTimeEntry(req.params.id);
      res.json({ message: "Time entry deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });
  
  // ===== TIME OFF REQUEST ROUTES =====
  
  // Get all time off requests
  app.get("/api/time-off-requests", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      let requests;
      if (user.role === 'CEO') {
        requests = await storage.getAllTimeOffRequests();
      } else {
        requests = await storage.getTimeOffRequestsByUser(user.id);
      }
      
      // Enrich with user info
      const users = await storage.getAllUsers();
      const enrichedRequests = requests.map((r: any) => {
        const requestUser = users.find(u => u.id === r.userId);
        const approver = r.approvedBy ? users.find(u => u.id === r.approvedBy) : null;
        return {
          ...r,
          userName: requestUser?.name || 'Unknown',
          userEmail: requestUser?.email,
          approverName: approver?.name,
        };
      });
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error('Get time off requests error:', error);
      res.status(500).json({ error: "Failed to fetch time off requests" });
    }
  });
  
  // Create time off request
  app.post("/api/time-off-requests", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertTimeOffRequestSchema.safeParse({ ...req.body, userId: user.id });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const request = await storage.createTimeOffRequest(result.data);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'CREATE',
        entityType: 'TimeOffRequest',
        entityId: request.id,
        details: `Requested ${result.data.type} from ${result.data.startDate} to ${result.data.endDate}`,
      });
      
      res.status(201).json(request);
    } catch (error) {
      console.error('Create time off request error:', error);
      res.status(500).json({ error: "Failed to create time off request" });
    }
  });
  
  // Update time off request (approve/reject - CEO only, or update own pending request)
  app.patch("/api/time-off-requests/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const request = await storage.getTimeOffRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Time off request not found" });
      }
      
      // CEO can approve/reject
      if (req.body.status && user.role === 'CEO') {
        const updates = {
          status: req.body.status,
          approvedBy: user.id,
        };
        const updated = await storage.updateTimeOffRequest(req.params.id, updates);
        
        // Create audit log
        await storage.createAuditLog({
          userId: user.id,
          action: 'UPDATE',
          entityType: 'TimeOffRequest',
          entityId: request.id,
          details: `${req.body.status} time off request`,
        });
        
        return res.json(updated);
      }
      
      // Users can update their own pending requests
      if (request.userId === user.id && request.status === 'Pending') {
        const updated = await storage.updateTimeOffRequest(req.params.id, req.body);
        return res.json(updated);
      }
      
      res.status(403).json({ error: "Not authorized to update this request" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update time off request" });
    }
  });
  
  // Delete time off request
  app.delete("/api/time-off-requests/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const request = await storage.getTimeOffRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Time off request not found" });
      }
      if (request.userId !== user.id && user.role !== 'CEO') {
        return res.status(403).json({ error: "Not authorized to delete this request" });
      }
      
      await storage.deleteTimeOffRequest(req.params.id);
      res.json({ message: "Time off request deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time off request" });
    }
  });
  
  // ===== AUDIT LOG ROUTES =====
  
  // Get audit logs (CEO only)
  app.get("/api/audit-logs", requireCEO, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const logs = await storage.getAuditLogs(limit);
      
      // Enrich with user names and add timestamp alias
      const users = await storage.getAllUsers();
      const enrichedLogs = logs.map((log: any) => {
        const logUser = users.find(u => u.id === log.userId);
        return {
          ...log,
          userName: logUser?.name || 'System',
          timestamp: log.createdAt, // Alias for frontend compatibility
        };
      });
      
      res.json(enrichedLogs);
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });
  
  // Get audit logs for specific entity
  app.get("/api/audit-logs/:entityType/:entityId", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getAuditLogsByEntity(req.params.entityType, req.params.entityId);
      
      // Enrich with user names and add timestamp alias
      const users = await storage.getAllUsers();
      const enrichedLogs = logs.map((log: any) => {
        const logUser = users.find(u => u.id === log.userId);
        return {
          ...log,
          userName: logUser?.name || 'System',
          timestamp: log.createdAt, // Alias for frontend compatibility
        };
      });
      
      res.json(enrichedLogs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs for entity" });
    }
  });
  
  // ===== INVESTOR CRM ROUTES =====
  
  // Get all investors
  app.get("/api/investors", requireAuth, async (req, res) => {
    try {
      const investors = await storage.getAllInvestors();
      res.json(investors);
    } catch (error) {
      console.error('Get investors error:', error);
      res.status(500).json({ error: "Failed to fetch investors" });
    }
  });
  
  // Get single investor with interactions
  app.get("/api/investors/:id", requireAuth, async (req, res) => {
    try {
      const investor = await storage.getInvestor(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      
      const interactions = await storage.getInvestorInteractions(investor.id);
      
      // Enrich interactions with user names
      const users = await storage.getAllUsers();
      const enrichedInteractions = interactions.map((i: any) => {
        const interactionUser = users.find(u => u.id === i.userId);
        return {
          ...i,
          userName: interactionUser?.name || 'Unknown',
        };
      });
      
      res.json({ ...investor, interactions: enrichedInteractions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch investor" });
    }
  });
  
  // Create investor (CEO only)
  app.post("/api/investors", requireCEO, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertInvestorSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const investor = await storage.createInvestor(result.data);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'CREATE',
        entityType: 'Investor',
        entityId: investor.id,
        details: `Created investor: ${result.data.name} from ${result.data.firm}`,
      });
      
      res.status(201).json(investor);
    } catch (error) {
      console.error('Create investor error:', error);
      res.status(500).json({ error: "Failed to create investor" });
    }
  });
  
  // Update investor
  app.patch("/api/investors/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const investor = await storage.getInvestor(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      
      const updated = await storage.updateInvestor(req.params.id, req.body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Investor',
        entityId: investor.id,
        details: `Updated investor: ${investor.name}`,
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update investor" });
    }
  });
  
  // Delete investor (CEO only)
  app.delete("/api/investors/:id", requireCEO, async (req, res) => {
    try {
      const user = req.user as any;
      const investor = await storage.getInvestor(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      
      await storage.deleteInvestor(req.params.id);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'DELETE',
        entityType: 'Investor',
        entityId: req.params.id,
        details: `Deleted investor: ${investor.name}`,
      });
      
      res.json({ message: "Investor deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete investor" });
    }
  });
  
  // Create investor interaction
  app.post("/api/investors/:investorId/interactions", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const investor = await storage.getInvestor(req.params.investorId);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      
      const result = insertInvestorInteractionSchema.safeParse({
        ...req.body,
        investorId: req.params.investorId,
        userId: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      
      const interaction = await storage.createInvestorInteraction(result.data);
      
      // Update last contact date on investor
      await storage.updateInvestor(investor.id, { lastContactDate: result.data.date });
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'CREATE',
        entityType: 'InvestorInteraction',
        entityId: interaction.id,
        details: `Logged ${result.data.type} interaction with ${investor.name}`,
      });
      
      res.status(201).json(interaction);
    } catch (error) {
      console.error('Create interaction error:', error);
      res.status(500).json({ error: "Failed to create interaction" });
    }
  });
  
  // Delete investor interaction
  app.delete("/api/investor-interactions/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteInvestorInteraction(req.params.id);
      res.json({ message: "Interaction deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete interaction" });
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
