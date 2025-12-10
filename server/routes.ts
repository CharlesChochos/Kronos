import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertDealSchema, insertTaskSchema, insertMeetingSchema, insertNotificationSchema, insertAssistantConversationSchema, insertAssistantMessageSchema, insertTimeEntrySchema, insertTimeOffRequestSchema, insertAuditLogSchema, insertInvestorSchema, insertInvestorInteractionSchema, insertOkrSchema, insertStakeholderSchema, insertAnnouncementSchema, insertPollSchema, insertMentorshipPairingSchema, insertClientPortalAccessSchema, insertDocumentTemplateSchema, insertInvestorMatchSchema, insertUserPreferencesSchema, insertDealTemplateSchema, insertCalendarEventSchema, insertTaskAttachmentRecordSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { sendMeetingInvite, sendPasswordResetEmail, sendUserInviteEmail } from "./email";
import { validateBody, loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from "./validation";
import { generalLimiter, authLimiter, strictLimiter, uploadLimiter, aiLimiter, preferencesLimiter } from "./rateLimiter";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import multer from "multer";
import * as XLSX from "xlsx";

// PostgreSQL session store
const PgSession = connectPgSimple(session);

// Use production database URL when deployed, otherwise use development database
const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
const databaseUrl = isProduction 
  ? (process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!)
  : process.env.DATABASE_URL!;

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
  // Trust proxy for rate limiting behind reverse proxy (Replit)
  app.set('trust proxy', 1);
  
  // Session configuration with PostgreSQL store
  // By default, sessions expire when browser closes (no maxAge)
  // Only persist sessions when user checks "Stay connected"
  app.use(
    session({
      store: new PgSession({
        conString: databaseUrl,
        tableName: 'sessions',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "kronos-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: 'lax',
        // No maxAge set by default = session cookie that expires on browser close
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

          // Check user status - only active users can log in
          if (user.status === 'pending') {
            return done(null, false, { message: "Your account is pending approval. Please wait for an administrator to approve your access." });
          }
          if (user.status === 'suspended') {
            return done(null, false, { message: "Your account has been suspended. Please contact an administrator." });
          }
          if (user.status === 'rejected') {
            return done(null, false, { message: "Your registration request was not approved. Please contact an administrator for more information." });
          }
          if (user.status !== 'active') {
            return done(null, false, { message: "Your account is not active. Please contact an administrator." });
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

  // Middleware to check admin access level
  const requireCEO = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user?.accessLevel === 'admin') {
      return next();
    }
    res.status(403).json({ error: "Access denied. Admin access required." });
  };
  
  // Middleware to block external users from internal routes
  const requireInternal = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user?.role !== 'External') {
      return next();
    }
    res.status(403).json({ error: "Access denied. Internal users only." });
  };

  // ===== AUTH ROUTES =====
  
  // Helper to create audit log
  const createAuditLog = async (req: any, action: string, entityType: string, entityId?: string, entityName?: string, details?: any) => {
    try {
      await storage.createAuditLogTableEntry({
        userId: req.user?.id || null,
        userName: req.user?.name || 'System',
        action,
        entityType,
        entityId: entityId || null,
        entityName: entityName || null,
        details: details || {},
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
      });
    } catch (err) {
      console.error('Failed to create audit log:', err);
    }
  };

  // Sign up
  app.post("/api/auth/signup", authLimiter, async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }

      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered. Please sign in instead." });
      }

      // Check if this is the first user (make them CEO and active)
      const allUsers = await storage.getAllUsers();
      const isFirstUser = allUsers.length === 0;
      
      // SECURITY: Non-first users are always assigned 'Associate' role
      // Only CEOs can grant elevated roles after approval via admin routes
      const userData = {
        ...result.data,
        status: isFirstUser ? 'active' : 'pending',
        role: isFirstUser ? 'CEO' : 'Associate', // Always Associate for non-first users
      };

      const user = await storage.createUser(userData);
      
      // Create audit log for signup
      await createAuditLog(req, 'user_signup', 'user', user.id, user.name, { email: user.email, role: user.role, status: user.status, jobTitle: user.jobTitle });
      
      // Notify all admins about new signup request
      if (!isFirstUser) {
        const ceos = allUsers.filter(u => u.accessLevel === 'admin' && u.status === 'active');
        for (const ceo of ceos) {
          await storage.createNotification({
            userId: ceo.id,
            title: 'New Signup Request',
            message: `${user.name} (${user.jobTitle || 'No title'}) has requested access to the platform`,
            type: 'info',
            link: '/ceo/admin',
          });
        }
      }
      
      // If first user (CEO), auto-login
      if (isFirstUser) {
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ error: "Error logging in after signup" });
          }
          res.json(sanitizeUser(user));
        });
      } else {
        // For other users, return success but don't login
        res.json({ 
          success: true, 
          pending: true,
          message: "Your account has been created and is pending approval. You'll be notified when an administrator approves your access."
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Login
  app.post("/api/auth/login", authLimiter, validateBody(loginSchema), (req, res, next) => {
    const { rememberMe } = req.body;
    
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      
      // Check if 2FA is enabled for this user
      if (user.twoFactorEnabled) {
        // Store rememberMe preference for 2FA completion
        (req.session as any).pendingRememberMe = rememberMe;
        // Don't log in yet - return a flag indicating 2FA is required
        return res.json({ 
          requiresTwoFactor: true, 
          email: user.email,
          message: "Please enter your two-factor authentication code"
        });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login error" });
        }
        
        // Configure session cookie based on rememberMe
        // If rememberMe is true, session persists for 7 days
        // Otherwise, session expires when browser closes (session cookie)
        if (rememberMe) {
          req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        } else {
          // Explicitly set to session cookie (expires on browser close)
          req.session.cookie.maxAge = null as any;
          req.session.cookie.expires = false as any;
        }
        
        await createAuditLog(req, 'login', 'user', user.id, user.name, { method: 'password' });
        res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const userName = user?.name;
    
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout error" });
      }
      
      if (userId && userName) {
        createAuditLog(req, 'logout', 'user', userId, userName, {}).catch(() => {});
      }
      
      res.json({ message: "Logged out successfully" });
    });
  });

  // Forgot Password - Request Reset
  app.post("/api/auth/forgot-password", strictLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
    try {
      const { email } = req.body;

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
  app.post("/api/auth/reset-password", strictLimiter, validateBody(resetPasswordSchema), async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      // Find valid token
      const resetToken = await storage.getValidPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset token. Please request a new password reset." });
      }

      // Update the user's password
      await storage.updateUserPassword(resetToken.userId, newPassword);

      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);
      
      // Get user and activate if pending (for invited users setting password for first time)
      if (resetToken.userId) {
        const user = await storage.getUser(resetToken.userId);
        if (user) {
          // If user is pending, activate them (invited user completing setup)
          if (user.status === 'pending') {
            await storage.updateUserStatus(user.id, 'active');
            await createAuditLog(req, 'user_activated', 'user', user.id, user.name, { 
              method: 'invite_completion',
              previousStatus: 'pending',
              newStatus: 'active'
            });
          }
          await createAuditLog(req, 'password_reset', 'user', user.id, user.name, { method: 'reset_token' });
        }
      }

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
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.mp3', '.zip', '.rar', '.7z'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'));
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
  app.post("/api/upload", uploadLimiter, requireAuth, upload.single('file'), (req, res) => {
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
  app.get("/api/users", requireAuth, requireInternal, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(user => sanitizeUser(user));
      
      // Admin can see all user details
      if (currentUser.accessLevel === 'admin') {
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

  app.get("/api/users/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Admin can see anyone, others can only see themselves
      if (currentUser.accessLevel !== 'admin' && currentUser.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  
  // ===== ADMIN ROUTES (CEO ONLY) =====
  
  // Get pending users (CEO only)
  app.get("/api/admin/pending-users", requireCEO, async (req, res) => {
    try {
      const pendingUsers = await storage.getUsersByStatus('pending');
      res.json(pendingUsers.map(u => sanitizeUser(u)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending users" });
    }
  });
  
  // Approve user (CEO only)
  app.post("/api/admin/users/:id/approve", requireCEO, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.status !== 'pending') {
        return res.status(400).json({ error: "User is not in pending status" });
      }
      
      const updatedUser = await storage.updateUserStatus(req.params.id, 'active');
      await createAuditLog(req, 'user_approved', 'user', user.id, user.name, { previousStatus: user.status, newStatus: 'active', approvedBy: (req.user as any).name });
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to approve user" });
    }
  });
  
  // Reject user (CEO only) - deletes the pending user
  app.post("/api/admin/users/:id/reject", requireCEO, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.status !== 'pending') {
        return res.status(400).json({ error: "User is not in pending status" });
      }
      
      await createAuditLog(req, 'user_rejected', 'user', user.id, user.name, { rejectedBy: (req.user as any).name });
      await storage.updateUserStatus(req.params.id, 'rejected');
      
      res.json({ success: true, message: "User registration rejected" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject user" });
    }
  });
  
  // Suspend user (CEO only)
  app.post("/api/admin/users/:id/suspend", requireCEO, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.id === currentUser.id) {
        return res.status(400).json({ error: "You cannot suspend yourself" });
      }
      
      const updatedUser = await storage.updateUserStatus(req.params.id, 'suspended');
      await createAuditLog(req, 'user_suspended', 'user', user.id, user.name, { previousStatus: user.status, newStatus: 'suspended', suspendedBy: currentUser.name });
      
      // Invalidate suspended user's session by destroying all sessions for that user
      // Note: With PostgreSQL session store, we can delete sessions directly
      try {
        const { db } = await import("./db");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`DELETE FROM sessions WHERE sess::jsonb->'passport'->>'user' = ${req.params.id}`);
      } catch (sessionErr) {
        console.error('Failed to invalidate suspended user sessions:', sessionErr);
        // Continue even if session cleanup fails
      }
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to suspend user" });
    }
  });
  
  // Reactivate user (CEO only)
  app.post("/api/admin/users/:id/reactivate", requireCEO, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.status !== 'suspended') {
        return res.status(400).json({ error: "User is not suspended" });
      }
      
      const updatedUser = await storage.updateUserStatus(req.params.id, 'active');
      await createAuditLog(req, 'user_reactivated', 'user', user.id, user.name, { previousStatus: user.status, newStatus: 'active', reactivatedBy: (req.user as any).name });
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to reactivate user" });
    }
  });
  
  // Change user role (CEO only) - Legacy endpoint
  app.patch("/api/admin/users/:id/role", requireCEO, async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ['CEO', 'Associate', 'Director', 'Managing Director', 'Analyst'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      const currentUser = req.user as any;
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Prevent demoting the last admin
      if (user.accessLevel === 'admin' && role !== 'CEO') {
        const allUsers = await storage.getAllUsers();
        const adminCount = allUsers.filter(u => u.accessLevel === 'admin' && u.status === 'active').length;
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot demote the only admin. Promote another user to admin first." });
        }
      }
      
      const updatedUser = await storage.updateUserProfile(req.params.id, { role });
      await createAuditLog(req, 'role_changed', 'user', user.id, user.name, { previousRole: user.role, newRole: role, changedBy: currentUser.name });
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });
  
  // Change user access level (admin only)
  app.patch("/api/admin/users/:id/access-level", requireCEO, async (req, res) => {
    try {
      const { accessLevel } = req.body;
      const validLevels = ['admin', 'standard'];
      if (!accessLevel || !validLevels.includes(accessLevel)) {
        return res.status(400).json({ error: "Invalid access level. Must be 'admin' or 'standard'." });
      }
      
      const currentUser = req.user as any;
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Prevent demoting the last admin
      if (user.accessLevel === 'admin' && accessLevel === 'standard') {
        const allUsers = await storage.getAllUsers();
        const adminCount = allUsers.filter(u => u.accessLevel === 'admin' && u.status === 'active').length;
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot demote the only admin. Promote another user to admin first." });
        }
      }
      
      const updatedUser = await storage.updateUserAccessLevel(req.params.id, accessLevel);
      await createAuditLog(req, 'access_level_changed', 'user', user.id, user.name, { 
        previousAccessLevel: user.accessLevel, 
        newAccessLevel: accessLevel, 
        changedBy: currentUser.name 
      });
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to update user access level" });
    }
  });
  
  // Get audit logs (CEO only)
  app.get("/api/admin/audit-logs", requireCEO, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogTableEntries(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Invite new user (Admin only)
  app.post("/api/admin/invite-user", generalLimiter, requireCEO, async (req, res) => {
    try {
      const { name, email, accessLevel, jobTitle } = req.body;
      const currentUser = req.user as any;

      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      // Validate email format
      if (!email.includes('@')) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }

      // Create user with a temporary random password (they'll set their own via reset link)
      const tempPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        accessLevel: accessLevel || 'standard',
        jobTitle: jobTitle || undefined,
        status: 'pending', // Will be activated when they set their password
        role: 'Employee',
      });

      // Create password reset token (24 hour expiry for invites)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await storage.createPasswordResetToken(newUser.id, token, expiresAt);

      // Generate setup link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000';
      const setupLink = `${baseUrl}/reset-password?token=${token}`;

      // Send invite email
      const emailResult = await sendUserInviteEmail({
        email,
        userName: name,
        inviterName: currentUser.name,
        accessLevel: accessLevel || 'standard',
        jobTitle,
        setupLink,
      });

      if (!emailResult.success) {
        console.error('Failed to send invite email:', emailResult.error);
        // User was created but email failed - still return success but warn
        return res.json({ 
          user: sanitizeUser(newUser), 
          emailSent: false,
          message: "User created but invite email could not be sent. You may need to resend the invite."
        });
      }

      // Log the invite action
      await createAuditLog(req, 'user_invited', 'user', newUser.id, newUser.name, { 
        invitedBy: currentUser.name,
        accessLevel: accessLevel || 'standard',
        jobTitle: jobTitle || null,
      });

      res.json({ 
        user: sanitizeUser(newUser), 
        emailSent: true,
        message: "User invited successfully. They will receive an email to set up their account."
      });
    } catch (error) {
      console.error('Error inviting user:', error);
      res.status(500).json({ error: "Failed to invite user" });
    }
  });

  // Resend invite to pending user (Admin only)
  app.post("/api/admin/users/:id/resend-invite", generalLimiter, requireCEO, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.status !== 'pending') {
        return res.status(400).json({ error: "Can only resend invites to pending users" });
      }

      // Create new password reset token (24 hour expiry)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Generate setup link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000';
      const setupLink = `${baseUrl}/reset-password?token=${token}`;

      // Send invite email
      const emailResult = await sendUserInviteEmail({
        email: user.email,
        userName: user.name,
        inviterName: currentUser.name,
        accessLevel: user.accessLevel,
        jobTitle: user.jobTitle || undefined,
        setupLink,
      });

      if (!emailResult.success) {
        return res.status(500).json({ error: "Failed to send invite email. Please try again." });
      }

      await createAuditLog(req, 'invite_resent', 'user', user.id, user.name, { 
        resentBy: currentUser.name,
      });

      res.json({ message: "Invite email resent successfully" });
    } catch (error) {
      console.error('Error resending invite:', error);
      res.status(500).json({ error: "Failed to resend invite" });
    }
  });

  // ===== CUSTOM SECTORS ROUTES =====
  
  app.get("/api/custom-sectors", requireAuth, requireInternal, async (req, res) => {
    try {
      const sectors = await storage.getAllCustomSectors();
      res.json(sectors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch custom sectors" });
    }
  });
  
  app.post("/api/custom-sectors", requireAuth, requireInternal, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Sector name is required" });
      }
      
      const currentUser = req.user as any;
      const sector = await storage.createCustomSector({
        name: name.trim(),
        createdBy: currentUser.id,
      });
      res.json(sector);
    } catch (error: any) {
      // Handle unique constraint violation (duplicate sector)
      if (error.code === '23505') {
        return res.status(400).json({ error: "This sector already exists" });
      }
      res.status(500).json({ error: "Failed to create custom sector" });
    }
  });

  // ===== DEAL ROUTES =====
  
  app.get("/api/deals", requireAuth, requireInternal, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/deals/:id", requireAuth, requireInternal, async (req, res) => {
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
  app.post("/api/deals", generalLimiter, requireCEO, async (req, res) => {
    try {
      const result = insertDealSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const deal = await storage.createDeal(result.data);
      await createAuditLog(req, 'deal_created', 'deal', deal.id, deal.name, { value: deal.value, client: deal.client, sector: deal.sector, stage: deal.stage });
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  // Update deal (CEO can update any deal, employees can only update deals they're assigned to)
  app.patch("/api/deals/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const user = req.user as any;
      const deal = await storage.getDeal(req.params.id);
      
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      // Admins can update any deal
      if (user.accessLevel !== 'admin') {
        // Non-admin users can only update deals they're assigned to (in pod team)
        const podTeam = (deal as any).podTeam || [];
        const isAssigned = podTeam.some((member: any) => 
          (user.id && (member.userId === user.id || member.id === user.id)) ||
          (user.email && member.email === user.email) ||
          (user.name && member.name === user.name)
        );
        
        if (!isAssigned) {
          return res.status(403).json({ error: "You can only update deals you're assigned to" });
        }
      }
      
      const result = insertDealSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const updatedDeal = await storage.updateDeal(req.params.id, result.data);
      if (!updatedDeal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      const changes: Record<string, any> = {};
      if (result.data.stage && result.data.stage !== deal.stage) changes.stage = { from: deal.stage, to: result.data.stage };
      if (result.data.status && result.data.status !== deal.status) changes.status = { from: deal.status, to: result.data.status };
      if (result.data.progress !== undefined && result.data.progress !== deal.progress) changes.progress = { from: deal.progress, to: result.data.progress };
      if (result.data.value !== undefined && result.data.value !== deal.value) changes.value = { from: deal.value, to: result.data.value };
      if (result.data.client && result.data.client !== deal.client) changes.client = { from: deal.client, to: result.data.client };
      if (result.data.lead && result.data.lead !== deal.lead) changes.lead = { from: deal.lead, to: result.data.lead };
      if (Object.keys(changes).length > 0) {
        await createAuditLog(req, 'deal_updated', 'deal', deal.id, deal.name, changes);
        
        // Notify admins about deal stage/status changes (if updated by non-admin)
        if ((changes.stage || changes.status) && user.accessLevel !== 'admin') {
          const allUsers = await storage.getAllUsers();
          const ceos = allUsers.filter(u => u.accessLevel === 'admin' && u.status === 'active');
          for (const ceo of ceos) {
            await storage.createNotification({
              userId: ceo.id,
              title: 'Deal Status Update',
              message: changes.stage 
                ? `${deal.name} moved from ${changes.stage.from} to ${changes.stage.to} by ${user.name}`
                : `${deal.name} status changed to ${changes.status.to} by ${user.name}`,
              type: 'info',
              link: '/ceo/deals',
            });
          }
        }
      }
      res.json(updatedDeal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  // Delete deal (CEO only)
  app.delete("/api/deals/:id", requireCEO, async (req, res) => {
    try {
      const deal = await storage.getDeal(req.params.id);
      await storage.deleteDeal(req.params.id);
      if (deal) {
        await createAuditLog(req, 'deal_deleted', 'deal', req.params.id, deal.name, { client: deal.client, value: deal.value });
      }
      res.json({ message: "Deal deleted successfully" });
    } catch (error) {
      console.error('Deal delete error:', error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // ===== DEAL FEES ROUTES =====
  
  app.get("/api/deals/:dealId/fees", requireAuth, requireInternal, async (req, res) => {
    try {
      const fees = await storage.getDealFees(req.params.dealId);
      res.json(fees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deal fees" });
    }
  });

  app.get("/api/deal-fees", requireAuth, requireInternal, async (req, res) => {
    try {
      const fees = await storage.getAllDealFees();
      res.json(fees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch all deal fees" });
    }
  });

  app.post("/api/deals/:dealId/fees", requireAuth, requireInternal, async (req, res) => {
    try {
      const fee = await storage.createDealFee({
        ...req.body,
        dealId: req.params.dealId,
      });
      res.json(fee);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal fee" });
    }
  });

  app.patch("/api/deal-fees/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const fee = await storage.updateDealFee(req.params.id, req.body);
      if (!fee) {
        return res.status(404).json({ error: "Fee not found" });
      }
      res.json(fee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal fee" });
    }
  });

  app.delete("/api/deal-fees/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.deleteDealFee(req.params.id);
      res.json({ message: "Fee deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal fee" });
    }
  });

  // ===== MEMBER TAGGING WITH NOTIFICATIONS =====
  
  // Tag member on deal/opportunity and notify them
  app.post("/api/deals/:dealId/tag-member", requireAuth, requireInternal, async (req, res) => {
    try {
      const user = req.user as any;
      const { memberId, memberName, memberRole } = req.body;
      
      if (!memberId || !memberName) {
        return res.status(400).json({ error: "Member ID and name are required" });
      }
      
      const deal = await storage.getDeal(req.params.dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      // Get current pod team
      const currentPodTeam = (deal.podTeam as any[] || []);
      
      // Check if already tagged
      if (currentPodTeam.some((m: any) => m.userId === memberId)) {
        return res.status(400).json({ error: "Member is already tagged on this deal" });
      }
      
      // Add member to pod team
      const newMember = {
        userId: memberId,
        name: memberName,
        role: memberRole || 'Team Member',
      };
      
      const updatedDeal = await storage.updateDeal(req.params.dealId, {
        podTeam: [...currentPodTeam, newMember],
      });
      
      // Create notification for the tagged member
      const dealType = (deal as any).dealType === 'Opportunity' ? 'opportunity' : 'deal';
      await storage.createNotification({
        userId: memberId,
        title: `You were tagged on an ${dealType}`,
        message: `${user.name} tagged you on "${deal.name}" (${deal.client}). Click to view details.`,
        type: 'info',
        link: dealType === 'opportunity' ? '/ceo/opportunities' : '/ceo/deals',
      });
      
      res.json(updatedDeal);
    } catch (error) {
      console.error('Tag member error:', error);
      res.status(500).json({ error: "Failed to tag member" });
    }
  });
  
  // Remove member from deal/opportunity
  app.post("/api/deals/:dealId/remove-member", requireAuth, requireInternal, async (req, res) => {
    try {
      const { memberId } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "Member ID is required" });
      }
      
      const deal = await storage.getDeal(req.params.dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      // Get current pod team and remove member
      const currentPodTeam = (deal.podTeam as any[] || []);
      const updatedPodTeam = currentPodTeam.filter((m: any) => m.userId !== memberId);
      
      const updatedDeal = await storage.updateDeal(req.params.dealId, {
        podTeam: updatedPodTeam,
      });
      
      res.json(updatedDeal);
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // ===== STAGE-BASED ROUTES =====

  // Stage Documents
  app.get("/api/deals/:dealId/stage-documents", requireAuth, requireInternal, async (req, res) => {
    try {
      const { stage } = req.query;
      const docs = await storage.getStageDocuments(req.params.dealId, stage as string | undefined);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stage documents" });
    }
  });

  app.post("/api/deals/:dealId/stage-documents", requireAuth, requireInternal, async (req, res) => {
    try {
      const user = req.user as any;
      const dealId = req.params.dealId;
      
      // Create stage document
      const doc = await storage.createStageDocument({
        ...req.body,
        dealId,
        uploadedBy: user.id,
        uploaderName: user.name,
      });
      
      // Also archive to document library for Asset Management deals
      const deal = await storage.getDeal(dealId);
      if (deal && deal.dealType === 'Asset Management') {
        try {
          // Map stage document category to document library category
          const categoryMap: Record<string, string> = {
            'General': 'Other',
            'Financial': 'Financial Documents',
            'Legal': 'Legal',
            'Compliance': 'Other',
            'Due Diligence': 'Other',
            'Term Sheet': 'Contracts',
            'NDA': 'Legal',
            'Pitch': 'Presentations',
          };
          const docCategory = categoryMap[req.body.category] || req.body.category || 'Other';
          
          await storage.createDocument({
            title: `${deal.name} - ${doc.title}`,
            type: 'stage_document',
            filename: `${doc.title.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}_${Date.now()}.pdf`,
            category: docCategory,
            dealId,
            tags: [deal.stage || 'Reception', 'Asset Management', 'Stage Document'],
            uploadedBy: user.id,
          });
        } catch (archiveError) {
          console.error('Failed to archive document to library (non-critical):', archiveError);
        }
      }
      
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stage document" });
    }
  });

  app.delete("/api/stage-documents/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.deleteStageDocument(req.params.id);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stage document" });
    }
  });

  // Stage Pod Members
  app.get("/api/deals/:dealId/stage-pod-members", requireAuth, requireInternal, async (req, res) => {
    try {
      const { stage } = req.query;
      const members = await storage.getStagePodMembers(req.params.dealId, stage as string | undefined);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stage pod members" });
    }
  });

  app.post("/api/deals/:dealId/stage-pod-members", requireAuth, requireInternal, async (req, res) => {
    try {
      const member = await storage.createStagePodMember({
        ...req.body,
        dealId: req.params.dealId,
      });
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to add stage pod member" });
    }
  });

  app.patch("/api/stage-pod-members/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const member = await storage.updateStagePodMember(req.params.id, req.body);
      if (!member) {
        return res.status(404).json({ error: "Pod member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stage pod member" });
    }
  });

  app.delete("/api/stage-pod-members/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.deleteStagePodMember(req.params.id);
      res.json({ message: "Pod member removed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove stage pod member" });
    }
  });

  // Stage Voice Notes
  app.get("/api/deals/:dealId/stage-voice-notes", requireAuth, requireInternal, async (req, res) => {
    try {
      const { stage } = req.query;
      const notes = await storage.getStageVoiceNotes(req.params.dealId, stage as string | undefined);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stage voice notes" });
    }
  });

  app.post("/api/deals/:dealId/stage-voice-notes", requireAuth, requireInternal, async (req, res) => {
    try {
      const user = req.user as any;
      const note = await storage.createStageVoiceNote({
        ...req.body,
        dealId: req.params.dealId,
        recordedBy: user.id,
        recorderName: user.name,
      });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stage voice note" });
    }
  });

  app.delete("/api/stage-voice-notes/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.deleteStageVoiceNote(req.params.id);
      res.json({ message: "Voice note deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stage voice note" });
    }
  });

  // ===== TASK COMMENTS ROUTES =====

  app.get("/api/tasks/:taskId/comments", requireAuth, requireInternal, async (req, res) => {
    try {
      const comments = await storage.getTaskComments(req.params.taskId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task comments" });
    }
  });

  app.post("/api/tasks/:taskId/comments", requireAuth, requireInternal, async (req, res) => {
    try {
      const user = req.user as any;
      const comment = await storage.createTaskComment({
        taskId: req.params.taskId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        content: req.body.content,
      });
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task comment" });
    }
  });

  app.patch("/api/task-comments/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const comment = await storage.updateTaskComment(req.params.id, req.body.content);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task comment" });
    }
  });

  app.delete("/api/task-comments/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.deleteTaskComment(req.params.id);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task comment" });
    }
  });

  // ===== USER SEARCH ROUTE (for autocomplete) =====

  app.get("/api/users/search", requireAuth, requireInternal, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      const users = await storage.searchUsers(q);
      res.json(users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        avatar: u.avatar,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // ===== TASK ROUTES =====
  
  app.get("/api/tasks", requireAuth, requireInternal, async (req, res) => {
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

  app.get("/api/tasks/:id", requireAuth, requireInternal, async (req, res) => {
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

  // Create task (any authenticated user)
  app.post("/api/tasks", generalLimiter, requireAuth, async (req, res) => {
    try {
      const result = insertTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const task = await storage.createTask(result.data);
      await createAuditLog(req, 'task_created', 'task', task.id, task.title, { priority: task.priority, assignedTo: task.assignedTo, dueDate: task.dueDate });
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task (CEO can update any, employees can only update their own task status)
  app.patch("/api/tasks/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const existingTask = await storage.getTask(req.params.id);
      
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Non-admin users can only update their own tasks (status, or forward to another user)
      if (currentUser.accessLevel !== 'admin') {
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
      
      const updateData = { ...result.data };
      if (updateData.status === 'Completed' && existingTask.status !== 'Completed') {
        (updateData as any).completedAt = new Date();
      } else if (updateData.status && updateData.status !== 'Completed' && existingTask.status === 'Completed') {
        (updateData as any).completedAt = null;
      }
      
      const task = await storage.updateTask(req.params.id, updateData);
      const changes: Record<string, any> = {};
      if (result.data.status && result.data.status !== existingTask.status) {
        changes.status = { from: existingTask.status, to: result.data.status };
      }
      if (result.data.priority && result.data.priority !== existingTask.priority) {
        changes.priority = { from: existingTask.priority, to: result.data.priority };
      }
      if (result.data.assignedTo && result.data.assignedTo !== existingTask.assignedTo) {
        changes.assignedTo = { from: existingTask.assignedTo, to: result.data.assignedTo };
      }
      if (Object.keys(changes).length > 0) {
        if (changes.status?.to === 'Completed') {
          await createAuditLog(req, 'task_completed', 'task', existingTask.id, existingTask.title, changes);
        } else {
          await createAuditLog(req, 'task_updated', 'task', existingTask.id, existingTask.title, changes);
        }
        
        // Notify admins about task status changes (if updated by non-admin)
        if (changes.status && currentUser.accessLevel !== 'admin') {
          const allUsers = await storage.getAllUsers();
          const ceos = allUsers.filter(u => u.accessLevel === 'admin' && u.status === 'active');
          for (const ceo of ceos) {
            await storage.createNotification({
              userId: ceo.id,
              title: changes.status.to === 'Completed' ? 'Task Completed' : 'Task Status Update',
              message: changes.status.to === 'Completed'
                ? `${currentUser.name} completed "${existingTask.title}"`
                : `${currentUser.name} updated "${existingTask.title}" status to ${changes.status.to}`,
              type: changes.status.to === 'Completed' ? 'success' : 'info',
              link: '/ceo/dashboard',
            });
          }
        }
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Delete task (CEO or task owner)
  app.delete("/api/tasks/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      // Allow deletion if user is admin OR if they are assigned to the task
      if (currentUser.accessLevel !== 'admin' && task.assignedTo !== currentUser.id) {
        return res.status(403).json({ error: "You can only delete tasks assigned to you" });
      }
      await storage.deleteTask(req.params.id);
      await createAuditLog(req, 'task_deleted', 'task', req.params.id, task.title, { assignedTo: task.assignedTo, deletedBy: currentUser.id });
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ===== MEETING ROUTES =====
  
  app.get("/api/meetings", requireAuth, requireInternal, async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", requireAuth, requireInternal, async (req, res) => {
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

  // Create meeting (any authenticated internal user)
  app.post("/api/meetings", generalLimiter, requireAuth, requireInternal, async (req, res) => {
    try {
      // Extract email formatting fields before validation (they're not in schema)
      const { localDate, localTime, organizerTimezone, ...meetingData } = req.body;
      
      // Convert scheduledFor to Date if it's a string
      if (typeof meetingData.scheduledFor === 'string') {
        meetingData.scheduledFor = new Date(meetingData.scheduledFor);
      }
      
      // Use user-provided video link if available, otherwise generate placeholder
      if (meetingData.videoPlatform && !meetingData.videoLink) {
        const meetingId = crypto.randomUUID().replace(/-/g, '').substring(0, 11);
        switch (meetingData.videoPlatform) {
          case 'zoom':
            meetingData.videoLink = `https://zoom.us/j/${meetingId}`;
            break;
          case 'google_meet':
            meetingData.videoLink = `https://meet.google.com/${meetingId.substring(0, 3)}-${meetingId.substring(3, 7)}-${meetingId.substring(7, 11)}`;
            break;
          case 'teams':
            meetingData.videoLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
            break;
        }
      }
      
      const result = insertMeetingSchema.safeParse(meetingData);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const meeting = await storage.createMeeting(result.data);
      
      // Log meeting creation
      await createAuditLog(req, 'meeting_created', 'meeting', meeting.id, meeting.title, { 
        scheduledFor: String(meeting.scheduledFor), 
        location: meeting.location || null, 
        participantCount: Array.isArray(result.data.participants) ? result.data.participants.length : 0
      });
      
      // Create notifications for participants
      const currentUser = req.user as any;
      const participantEmails: string[] = [];
      
      if (result.data.participants && Array.isArray(result.data.participants)) {
        // Get all users to match by email or user ID
        const allUsers = await storage.getAllUsers();
        for (const participantRef of result.data.participants as string[]) {
          // Match by ID or email
          const participant = allUsers.find(u => u.id === participantRef || u.email === participantRef);
          if (participant) {
            participantEmails.push(participant.email);
            if (participant.id !== currentUser.id) {
              // Determine correct link based on user access level
              const calendarLink = participant.accessLevel === 'admin' ? '/ceo/calendar' : '/employee/calendar';
              await storage.createNotification({
                userId: participant.id,
                title: "New Meeting Invitation",
                message: `You have been invited to "${result.data.title}" on ${new Date(result.data.scheduledFor as Date).toLocaleDateString()} by ${currentUser.name}`,
                type: "info",
                link: calendarLink,
              });
            }
          } else {
            // It's an email that doesn't match any user (external invitee)
            if (participantRef.includes('@')) {
              participantEmails.push(participantRef);
            }
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
      
      await createAuditLog(req, 'meeting_updated', 'meeting', meeting.id, meeting.title, {
        title: result.data.title,
        scheduledFor: result.data.scheduledFor ? String(result.data.scheduledFor) : undefined,
        location: result.data.location,
        status: result.data.status
      });
      
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  // Delete meeting (CEO only)
  app.delete("/api/meetings/:id", requireCEO, async (req, res) => {
    try {
      const meeting = await storage.getMeeting(req.params.id);
      await storage.deleteMeeting(req.params.id);
      
      if (meeting) {
        await createAuditLog(req, 'meeting_deleted', 'meeting', req.params.id, meeting.title, { scheduledFor: String(meeting.scheduledFor) });
      }
      
      res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  
  app.get("/api/notifications", requireAuth, requireInternal, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const notifications = await storage.getNotificationsByUser(currentUser.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, requireInternal, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Flag task and notify pod team members
  app.post("/api/notifications/flag", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { taskId, taskTitle, dealId, dealName, flaggedBy } = req.body;
      
      if (!taskId || !taskTitle || !dealId || !dealName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get the deal to find pod team members
      const deal = await storage.getDeal(dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      // Get all users who might be part of the pod team for this deal
      // This includes the deal lead and anyone with tasks assigned to this deal
      const allTasks = await storage.getAllTasks();
      const dealTasks = allTasks.filter(t => t.dealId === dealId);
      const assignedUserIds: string[] = [];
      
      // Add deal lead if exists
      if (deal.lead) {
        const users = await storage.getAllUsers();
        const leadUser = users.find(u => u.name === deal.lead);
        if (leadUser && !assignedUserIds.includes(leadUser.id)) {
          assignedUserIds.push(leadUser.id);
        }
      }
      
      // Add all users assigned to tasks on this deal
      dealTasks.forEach(task => {
        if (task.assignedTo && !assignedUserIds.includes(task.assignedTo)) {
          assignedUserIds.push(task.assignedTo);
        }
      });

      // Remove the current user from notifications (don't notify yourself)
      const filteredUserIds = assignedUserIds.filter((id: string) => id !== currentUser.id);

      // Create notifications for all pod team members
      const notifications = [];
      for (const userId of filteredUserIds) {
        const notification = await storage.createNotification({
          userId,
          title: 'Task Flagged for War Room',
          message: `${flaggedBy} flagged "${taskTitle}" on ${dealName} for team attention`,
          type: 'alert',
          link: '/war-room',
        });
        notifications.push(notification);
      }

      res.json({ 
        message: "Pod team notified", 
        notifiedCount: notifications.length 
      });
    } catch (error) {
      console.error("Error sending flag notifications:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  // ===== USER PREFERENCES ROUTE =====
  
  app.patch("/api/users/:id/preferences", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      // Users can only update their own preferences (admins can update anyone's)
      if (currentUser.id !== req.params.id && currentUser.accessLevel !== 'admin') {
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
        // Prevent escalation to CEO (only existing admins can be CEO)
        if (role === 'CEO' && currentUser.accessLevel !== 'admin') {
          return res.status(403).json({ error: "Cannot escalate to CEO role" });
        }
        // Prevent admin from changing their own role (to prevent lockout)
        if (currentUser.accessLevel === 'admin' && role !== 'CEO') {
          return res.status(403).json({ error: "Admin cannot change their own role" });
        }
        updates.role = role;
      }
      
      // Handle custom job title
      const { jobTitle } = req.body;
      if (jobTitle !== undefined) {
        (updates as any).jobTitle = jobTitle;
      }
      
      const updatedUser = await storage.updateUserProfile(req.params.id, updates);
      
      await createAuditLog(req, 'profile_updated', 'user', req.params.id, updatedUser?.name || currentUser.name, updates);
      
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
      
      await createAuditLog(req, 'password_changed', 'user', req.params.id, user.name, { method: 'self_service' });
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // ===== TWO-FACTOR AUTHENTICATION ROUTES =====
  
  // Generate 2FA secret and QR code for setup
  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    try {
      const { authenticator } = await import('otplib');
      const QRCode = await import('qrcode');
      
      const user = req.user as any;
      
      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already enabled" });
      }
      
      // Generate a secret
      const secret = authenticator.generateSecret();
      
      // Generate the otpauth URL
      const otpauthUrl = authenticator.keyuri(user.email, 'Kronos', secret);
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      
      // Temporarily store the secret (not yet enabled)
      await storage.updateUserTwoFactor(user.id, false, secret);
      
      res.json({ 
        secret,
        qrCodeUrl: qrCodeDataUrl,
        message: "Scan this QR code with your authenticator app, then verify with a code to enable 2FA"
      });
    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: "Failed to setup two-factor authentication" });
    }
  });
  
  // Verify and enable 2FA
  app.post("/api/auth/2fa/verify", requireAuth, async (req, res) => {
    try {
      const { authenticator } = await import('otplib');
      const { code } = req.body;
      const user = req.user as any;
      
      if (!code) {
        return res.status(400).json({ error: "Verification code is required" });
      }
      
      // Get the user with their secret
      const fullUser = await storage.getUser(user.id);
      if (!fullUser?.twoFactorSecret) {
        return res.status(400).json({ error: "Please start 2FA setup first" });
      }
      
      // Verify the code
      const isValid = authenticator.verify({ token: code, secret: fullUser.twoFactorSecret });
      
      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code. Please try again." });
      }
      
      // Enable 2FA
      await storage.updateUserTwoFactor(user.id, true, fullUser.twoFactorSecret);
      await createAuditLog(req, '2fa_enabled', 'user', user.id, user.name, { method: 'totp' });
      
      res.json({ message: "Two-factor authentication enabled successfully" });
    } catch (error) {
      console.error('2FA verify error:', error);
      res.status(500).json({ error: "Failed to verify two-factor authentication" });
    }
  });
  
  // Disable 2FA
  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    try {
      const { authenticator } = await import('otplib');
      const { code, password } = req.body;
      const user = req.user as any;
      
      if (!code || !password) {
        return res.status(400).json({ error: "Verification code and password are required" });
      }
      
      // Get the user with their secret and password
      const fullUser = await storage.getUser(user.id);
      if (!fullUser?.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is not enabled" });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, fullUser.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Invalid password" });
      }
      
      // Verify the code
      const isValid = authenticator.verify({ token: code, secret: fullUser.twoFactorSecret! });
      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      // Disable 2FA
      await storage.updateUserTwoFactor(user.id, false, undefined);
      await createAuditLog(req, '2fa_disabled', 'user', user.id, user.name, {});
      
      res.json({ message: "Two-factor authentication disabled successfully" });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ error: "Failed to disable two-factor authentication" });
    }
  });
  
  // Get 2FA status
  app.get("/api/auth/2fa/status", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const fullUser = await storage.getUser(user.id);
      
      res.json({ 
        enabled: fullUser?.twoFactorEnabled || false,
        hasSecret: !!fullUser?.twoFactorSecret
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get 2FA status" });
    }
  });
  
  // Verify 2FA code during login (called after initial password auth)
  app.post("/api/auth/2fa/login-verify", async (req, res) => {
    try {
      const { authenticator } = await import('otplib');
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      // Check user status
      if (user.status !== 'active') {
        return res.status(401).json({ error: "Account is not active" });
      }
      
      // Verify the code
      const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
      
      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      // Get rememberMe preference stored during initial login
      const rememberMe = (req.session as any).pendingRememberMe;
      delete (req.session as any).pendingRememberMe;
      
      // Log the user in
      req.login(user, async (err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to complete login" });
        }
        
        // Configure session cookie based on rememberMe
        // If rememberMe is true, session persists for 7 days
        // Otherwise, session expires when browser closes (session cookie)
        if (rememberMe) {
          req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        } else {
          req.session.cookie.maxAge = null as any;
          req.session.cookie.expires = false as any;
        }
        
        await createAuditLog(req, 'login_2fa', 'user', user.id, user.name, { method: 'totp' });
        res.json(sanitizeUser(user));
      });
    } catch (error) {
      console.error('2FA login verify error:', error);
      res.status(500).json({ error: "Failed to verify two-factor authentication" });
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

      const prompt = `You are a professional investment banking document generator for Kronos platform.

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
  app.get("/api/assistant/conversations", requireAuth, requireInternal, async (req, res) => {
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
  app.post("/api/assistant/conversations", requireAuth, requireInternal, async (req, res) => {
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
  app.get("/api/assistant/conversations/:id/messages", requireAuth, requireInternal, async (req, res) => {
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
  app.post("/api/assistant/conversations/:id/messages", aiLimiter, requireAuth, requireInternal, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const conversation = await storage.getAssistantConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== currentUser.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { content, attachments, mentions } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      // Save user message with attachments and mentions
      const userMessage = await storage.createAssistantMessage({
        conversationId: req.params.id,
        role: 'user',
        content,
        attachments: attachments || [],
        mentions: mentions || [],
      });
      
      // Create notifications for mentioned users (with validation and deduplication)
      if (mentions && Array.isArray(mentions) && mentions.length > 0) {
        const notifiedUserIds = new Set<string>();
        for (const mention of mentions) {
          // Skip self-mentions and duplicates
          if (!mention.userId || mention.userId === currentUser.id || notifiedUserIds.has(mention.userId)) {
            continue;
          }
          // Validate that the mentioned user exists
          const mentionedUser = await storage.getUser(mention.userId);
          if (!mentionedUser) {
            console.warn(`Mentioned user not found: ${mention.userId}`);
            continue;
          }
          // Create notification and track to avoid duplicates
          await storage.createNotification({
            userId: mention.userId,
            title: 'Mentioned in Kronos',
            message: `${currentUser.name} mentioned you in a conversation with Kronos AI`,
            type: 'info',
            link: '/ceo/assistant',
          });
          notifiedUserIds.add(mention.userId);
        }
      }
      
      // Gather expanded context for the AI
      const [deals, tasks, users, allTasks, investors, meetings, timeEntries, documents] = await Promise.all([
        storage.getAllDeals(),
        storage.getTasksByUser(currentUser.id),
        storage.getAllUsers(),
        storage.getAllTasks(),
        storage.getAllInvestors(),
        storage.getAllMeetings(),
        storage.getAllTimeEntries(),
        storage.getAllDocuments(),
      ]);
      
      // Calculate analytics
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Team workload analysis
      const teamWorkload = users.map(u => {
        const userTasks = allTasks.filter(t => t.assignedTo === u.id);
        const activeTasks = userTasks.filter(t => t.status !== 'Completed');
        const overdueTasks = userTasks.filter(t => new Date(t.dueDate) < now && t.status !== 'Completed');
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          activeTasks: activeTasks.length,
          overdueTasks: overdueTasks.length,
          completedThisWeek: userTasks.filter(t => t.status === 'Completed' && t.updatedAt && new Date(t.updatedAt) > oneWeekAgo).length,
          workloadScore: activeTasks.length + (overdueTasks.length * 2), // Higher = busier
        };
      });

      // Deal velocity & pipeline analytics
      const dealsByStage = deals.reduce((acc, d) => {
        acc[d.stage] = (acc[d.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const stalledDeals = deals.filter(d => {
        if (d.status !== 'Active') return false;
        const lastUpdate = d.updatedAt ? new Date(d.updatedAt) : null;
        return lastUpdate && lastUpdate < oneWeekAgo && d.progress < 100;
      });

      // Overdue tasks across platform
      const allOverdueTasks = allTasks.filter(t => 
        new Date(t.dueDate) < now && t.status !== 'Completed'
      );

      // Upcoming deadlines (next 7 days)
      const upcomingDeadlines = allTasks
        .filter(t => {
          const dueDate = new Date(t.dueDate);
          return dueDate >= now && dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && t.status !== 'Completed';
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      // Build enhanced context about the platform state
      const platformContext = {
        currentUser: { 
          id: currentUser.id, 
          name: currentUser.name, 
          role: currentUser.role,
          accessLevel: currentUser.accessLevel,
          activeDeals: currentUser.activeDeals,
          completedTasks: currentUser.completedTasks,
        },
        dealsSummary: {
          total: deals.length,
          active: deals.filter(d => d.status === 'Active').length,
          closed: deals.filter(d => d.status === 'Closed').length,
          stages: dealsByStage,
          totalValue: deals.reduce((sum, d) => sum + d.value, 0),
          averageValue: deals.length > 0 ? deals.reduce((sum, d) => sum + d.value, 0) / deals.length : 0,
          bySector: deals.reduce((acc, d) => {
            acc[d.sector] = (acc[d.sector] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        myTasks: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'Pending').length,
          inProgress: tasks.filter(t => t.status === 'In Progress').length,
          completed: tasks.filter(t => t.status === 'Completed').length,
          overdue: tasks.filter(t => new Date(t.dueDate) < now && t.status !== 'Completed').length,
        },
        teamMembers: users.map(u => ({ 
          id: u.id, 
          name: u.name, 
          role: u.role,
          activeDeals: u.activeDeals,
          completedTasks: u.completedTasks,
        })),
        teamWorkload,
        recentDeals: deals.slice(0, 10).map(d => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          value: d.value,
          client: d.client,
          sector: d.sector,
          lead: d.lead,
          progress: d.progress,
          status: d.status,
          dealType: d.dealType,
        })),
        allDeals: deals.map(d => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          value: d.value,
          client: d.client,
          sector: d.sector,
          lead: d.lead,
          progress: d.progress,
          status: d.status,
          dealType: d.dealType,
        })),
        upcomingTasks: tasks
          .filter(t => t.status !== 'Completed')
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, 10)
          .map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: t.dueDate,
            status: t.status,
            type: t.type,
            dealId: t.dealId,
          })),
        // New: Investor data
        investors: investors.slice(0, 20).map(inv => ({
          id: inv.id,
          name: inv.name,
          type: inv.type,
          focus: inv.focus,
          aum: inv.aum,
          minInvestment: inv.minInvestment,
          maxInvestment: inv.maxInvestment,
          preferredSectors: inv.preferredSectors,
          status: inv.status,
        })),
        investorStats: {
          total: investors.length,
          active: investors.filter(i => i.status === 'Active').length,
          byType: investors.reduce((acc, i) => {
            acc[i.type] = (acc[i.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        // New: Upcoming meetings
        upcomingMeetings: meetings
          .filter(m => new Date(m.date) >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 10)
          .map(m => ({
            id: m.id,
            title: m.title,
            date: m.date,
            time: m.time,
            location: m.location,
            dealId: m.dealId,
            attendees: m.attendees,
          })),
        // New: Documents summary
        documentStats: {
          total: documents.length,
          byCategory: documents.reduce((acc, d) => {
            const cat = d.category || 'Other';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        // New: Time tracking summary
        timeTrackingSummary: {
          totalEntriesThisMonth: timeEntries.filter(e => new Date(e.date) > oneMonthAgo).length,
          totalHoursThisMonth: timeEntries
            .filter(e => new Date(e.date) > oneMonthAgo)
            .reduce((sum, e) => sum + e.hours, 0),
        },
        // Proactive insights
        proactiveAlerts: {
          stalledDeals: stalledDeals.map(d => ({ id: d.id, name: d.name, stage: d.stage, daysSinceUpdate: d.updatedAt ? Math.floor((now.getTime() - new Date(d.updatedAt).getTime()) / (24 * 60 * 60 * 1000)) : 0 })),
          overdueTasks: allOverdueTasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, assignedTo: users.find(u => u.id === t.assignedTo)?.name || 'Unassigned' })),
          upcomingDeadlines: upcomingDeadlines.slice(0, 10).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, assignedTo: users.find(u => u.id === t.assignedTo)?.name || 'Unassigned', daysUntilDue: Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) })),
          highWorkloadTeamMembers: teamWorkload.filter(m => m.workloadScore > 10).map(m => ({ name: m.name, activeTasks: m.activeTasks, overdueTasks: m.overdueTasks })),
        },
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
      
      // Build the enhanced system prompt
      const systemPrompt = `You are Kronos, an advanced AI assistant for the Kronos investment banking operations platform at Equiturn. You help ${currentUser.accessLevel === 'admin' ? 'executives and Managing Directors' : 'investment banking professionals'} manage transactions, execute deals, and optimize team productivity.

## YOUR EXPERTISE - INVESTMENT BANKING KNOWLEDGE:

### Transaction Lifecycle:
- **Origination**: Client sourcing, mandate pitching, engagement letters, fee negotiations
- **Due Diligence**: VDR management, information requests, management presentations, Q&A coordination
- **Execution**: Transaction documentation, deal structuring, regulatory filings, closing mechanics
- **Deal Types**: M&A (buy-side/sell-side), capital raises, IPOs, debt financing, restructuring

### Key IB Terminology:
- **LOI/IOI**: Letter of Intent / Indication of Interest
- **SPA/APA**: Stock/Asset Purchase Agreement
- **VDR**: Virtual Data Room
- **CIM/IM**: Confidential Information Memorandum
- **DCF/LBO**: Discounted Cash Flow / Leveraged Buyout analysis
- **EBITDA multiples**: Enterprise value metrics
- **Term Sheet**: Non-binding summary of key transaction terms
- **Closing conditions**: Conditions precedent to transaction completion

### Stage-Based Best Practices:
- Origination: Focus on relationship building and deal qualification
- Due Diligence: Maintain momentum, respond to requests within 24-48 hours
- Negotiation: Balance commercial terms with closing certainty
- Documentation: Track open items, coordinate with legal counsel
- Closing: Ensure all conditions satisfied, coordinate funds flow

## YOUR CAPABILITIES:

### Query & Analysis:
- Answer questions about deals, pipeline status, tasks, investors, and team activities
- Provide insights on deal velocity, conversion rates, and stage progression
- Analyze team workload distribution and identify capacity constraints
- Calculate metrics like average time-in-stage, completion rates, and fee projections
- Match investors based on sector focus, check size, and investment criteria
- Summarize documents by category and deal association

### Actions You Can Take:
- CREATE TASKS: Assign work to team members with priorities and deadlines
- SCHEDULE MEETINGS: Book calls and meetings with internal or external attendees
- UPDATE DEALS: Modify stage, status, or progress for transactions
- UPDATE TASKS: Mark complete, change priority, or update status
- SEND MESSAGES: Communicate with team members via in-app chat
- SHARE FILES: Send documents to colleagues with context
- GENERATE DOCUMENTS: Draft term sheets, NDAs, deal memos, LOIs, checklists
- ANALYZE INVESTOR FIT: Find matching investors for specific deals
- GET DEAL RECOMMENDATIONS: Receive AI-powered next steps based on deal stage

### Proactive Intelligence:
- Flag stalled deals that haven't been updated recently (deal velocity alerts)
- Identify overdue tasks requiring immediate attention
- Alert about upcoming deadlines within the next week
- Highlight team members with high workload for capacity planning
- Suggest stage-appropriate next steps for active transactions

## CURRENT PLATFORM CONTEXT:
${JSON.stringify(platformContext, null, 2)}

## PROACTIVE ALERTS TO MENTION WHEN RELEVANT:
${platformContext.proactiveAlerts.stalledDeals.length > 0 ? `⚠️ ${platformContext.proactiveAlerts.stalledDeals.length} deals haven't been updated in over a week` : ''}
${platformContext.proactiveAlerts.overdueTasks.length > 0 ? `🔴 ${platformContext.proactiveAlerts.overdueTasks.length} tasks are overdue` : ''}
${platformContext.proactiveAlerts.upcomingDeadlines.length > 0 ? `📅 ${platformContext.proactiveAlerts.upcomingDeadlines.length} tasks due in the next 7 days` : ''}
${platformContext.proactiveAlerts.highWorkloadTeamMembers.length > 0 ? `👥 ${platformContext.proactiveAlerts.highWorkloadTeamMembers.length} team members have high workload` : ''}

## ACTION INSTRUCTIONS:

**Creating Tasks:** When asked to create/add a task, use create_task with title, assignee name, priority, and due date.
Example: "Create a task for Sarah to review the Alpha Corp proposal by Friday" -> call create_task

**Scheduling Meetings:** When asked to schedule/book a meeting, use schedule_meeting with title, date, time, and attendees.
Example: "Schedule a meeting with the tech team tomorrow at 2pm" -> call schedule_meeting

**Updating Deals:** When asked to update a deal's status, stage, or progress, use update_deal.
Example: "Update Alpha Corp deal to Negotiation stage" -> call update_deal

**Updating Tasks:** When asked to mark a task complete, change priority, or update status, use update_task.
Example: "Mark the compliance review task as completed" -> call update_task

**Sending Messages:** When asked to message someone, use send_message.
Example: "Tell Michael the meeting is moved to 3pm" -> call send_message

**Generating Documents:** When asked to draft, create, or generate a document, use generate_document.
Example: "Draft a term sheet for the TechCo deal" -> call generate_document with documentType: "term_sheet"
Available document types: term_sheet, nda, deal_memo, investor_update, email_draft, loi, due_diligence_checklist, closing_checklist, pitch_deck_outline

**Deal Recommendations:** When asked for advice or next steps on a deal, use get_deal_recommendation.
Example: "What should we focus on next for the Alpha Corp deal?" -> call get_deal_recommendation

**Investor Analysis:** When asked to find or match investors for a deal, use analyze_investor_fit.
Example: "Which investors would be good for the healthcare deal?" -> call analyze_investor_fit

**Market Data:** When asked about stock prices, market data, or company news, use get_market_data.
Example: "What's Apple's stock price?" -> call get_market_data with symbol: "AAPL"

**Document Summary:** When asked to summarize a document, use summarize_document.
Example: "Summarize the Alpha Corp NDA" -> call summarize_document

**Meeting Prep:** When asked to prepare for a meeting, use generate_meeting_prep.
Example: "Help me prepare for the investor call tomorrow" -> call generate_meeting_prep

**Pipeline Analytics:** When asked for pipeline metrics, performance data, or analytics, use get_pipeline_analytics.
Example: "What's our win rate this quarter?" -> call get_pipeline_analytics

**Team Performance:** When asked about team performance, productivity, or individual contributions, use get_team_performance.
Example: "How is Sarah performing this month?" -> call get_team_performance

**Reports:** When asked for a report or data summary, use generate_report.
Example: "Generate a pipeline report" -> call generate_report

## GUIDELINES:
- Be concise but thorough - investment bankers are busy
- Use specific data from the platform context when relevant
- Format responses with clear structure using markdown headers and bullets
- Proactively mention relevant alerts when they impact the user's work
- Always express transaction values in millions (e.g., $50M, $150M)
- For investor matching, prioritize sector alignment, then check size compatibility
- Reference team members by name for accountability
- Provide actionable insights with specific next steps
- When asked to perform an action, ALWAYS use the appropriate function
- Use professional IB terminology appropriately (DCF, EBITDA, VDR, etc.)
- When generating documents, auto-populate with deal data when available`;
      
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
        },
        {
          type: "function",
          function: {
            name: "create_task",
            description: "Create a new task and assign it to a team member. Use when user asks to create, add, or assign a task.",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "The title/description of the task"
                },
                assigneeName: {
                  type: "string",
                  description: "The name of the person to assign the task to"
                },
                priority: {
                  type: "string",
                  enum: ["Low", "Medium", "High", "Urgent"],
                  description: "Priority level of the task"
                },
                dueDate: {
                  type: "string",
                  description: "Due date in YYYY-MM-DD format"
                },
                dealName: {
                  type: "string",
                  description: "Optional: name of the deal this task is related to"
                }
              },
              required: ["title", "assigneeName", "priority", "dueDate"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "schedule_meeting",
            description: "Schedule a new meeting with team members. Use when user asks to schedule, book, or set up a meeting.",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "The title of the meeting"
                },
                date: {
                  type: "string",
                  description: "Date of the meeting in YYYY-MM-DD format"
                },
                time: {
                  type: "string",
                  description: "Time of the meeting (e.g., '14:00' or '2:00 PM')"
                },
                attendees: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of attendee names"
                },
                location: {
                  type: "string",
                  description: "Location or meeting room"
                },
                dealName: {
                  type: "string",
                  description: "Optional: name of the deal this meeting is about"
                },
                description: {
                  type: "string",
                  description: "Optional meeting description or agenda"
                }
              },
              required: ["title", "date", "time", "attendees"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "update_deal",
            description: "Update a deal's status, stage, or progress. Use when user asks to update, change, or modify a deal.",
            parameters: {
              type: "object",
              properties: {
                dealName: {
                  type: "string",
                  description: "The name of the deal to update"
                },
                stage: {
                  type: "string",
                  description: "New stage for the deal (e.g., 'Origination', 'Due Diligence', 'Negotiation', 'Closing')"
                },
                status: {
                  type: "string",
                  enum: ["Active", "On Hold", "Closed", "Won", "Lost"],
                  description: "New status for the deal"
                },
                progress: {
                  type: "number",
                  description: "Progress percentage (0-100)"
                }
              },
              required: ["dealName"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "update_task",
            description: "Update a task's status, priority, or other details. Use when user asks to mark complete, update, or change a task.",
            parameters: {
              type: "object",
              properties: {
                taskTitle: {
                  type: "string",
                  description: "The title of the task to update (partial match supported)"
                },
                status: {
                  type: "string",
                  enum: ["Pending", "In Progress", "Completed"],
                  description: "New status for the task"
                },
                priority: {
                  type: "string",
                  enum: ["Low", "Medium", "High", "Urgent"],
                  description: "New priority for the task"
                }
              },
              required: ["taskTitle"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_document",
            description: "Generate a document draft such as a term sheet, NDA, deal memo, investor update, or email draft. Use when user asks to create, draft, write, or generate any document.",
            parameters: {
              type: "object",
              properties: {
                documentType: {
                  type: "string",
                  enum: ["term_sheet", "nda", "deal_memo", "investor_update", "email_draft", "loi", "due_diligence_checklist", "closing_checklist", "pitch_deck_outline"],
                  description: "Type of document to generate"
                },
                dealName: {
                  type: "string",
                  description: "The deal this document relates to (optional)"
                },
                recipientName: {
                  type: "string",
                  description: "For emails/letters, the intended recipient"
                },
                additionalContext: {
                  type: "string",
                  description: "Any additional details or requirements for the document"
                }
              },
              required: ["documentType"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_deal_recommendation",
            description: "Get AI-powered recommendations for next steps on a deal based on its current stage, progress, and historical patterns. Use when user asks for advice, recommendations, or next steps on a deal.",
            parameters: {
              type: "object",
              properties: {
                dealName: {
                  type: "string",
                  description: "The name of the deal to get recommendations for"
                }
              },
              required: ["dealName"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "analyze_investor_fit",
            description: "Analyze and recommend investors that would be a good fit for a specific deal based on sector, investment size, and preferences. Use when user asks about investor matching, finding investors, or investor recommendations.",
            parameters: {
              type: "object",
              properties: {
                dealName: {
                  type: "string",
                  description: "The name of the deal to find investors for"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of investors to recommend (default 5)"
                }
              },
              required: ["dealName"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_market_data",
            description: "Get real-time stock market data including price, change, and company news. Use when user asks about stock prices, market data, or company financial news.",
            parameters: {
              type: "object",
              properties: {
                symbol: {
                  type: "string",
                  description: "Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)"
                },
                includeNews: {
                  type: "boolean",
                  description: "Whether to include recent company news (default: false)"
                }
              },
              required: ["symbol"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "summarize_document",
            description: "Summarize a document from the platform. Use when user asks for a summary, overview, or key points from a document.",
            parameters: {
              type: "object",
              properties: {
                documentId: {
                  type: "string",
                  description: "The ID of the document to summarize"
                },
                documentName: {
                  type: "string",
                  description: "The name of the document to summarize (alternative to documentId)"
                },
                summaryType: {
                  type: "string",
                  enum: ["brief", "detailed", "executive", "bullet_points"],
                  description: "Type of summary to generate (default: brief)"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_meeting_prep",
            description: "Generate meeting preparation materials including agenda, talking points, and relevant context. Use when user asks to prepare for a meeting.",
            parameters: {
              type: "object",
              properties: {
                meetingId: {
                  type: "string",
                  description: "The ID of the meeting to prepare for"
                },
                meetingTitle: {
                  type: "string",
                  description: "The title of the meeting (alternative to meetingId)"
                },
                includeContext: {
                  type: "boolean",
                  description: "Include related deal context (default: true)"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_pipeline_analytics",
            description: "Get detailed pipeline analytics including conversion rates, stage velocity, sector performance, and deal trends. Use when user asks for pipeline analysis, metrics, or performance data.",
            parameters: {
              type: "object",
              properties: {
                timeframe: {
                  type: "string",
                  enum: ["week", "month", "quarter", "year", "all"],
                  description: "Time period for analytics (default: quarter)"
                },
                sector: {
                  type: "string",
                  description: "Filter by specific sector (optional)"
                },
                metric: {
                  type: "string",
                  enum: ["conversion", "velocity", "value", "stage_distribution", "all"],
                  description: "Specific metric to analyze (default: all)"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_team_performance",
            description: "Get team performance insights including workload distribution, task completion rates, deal contributions, and productivity trends. Use when user asks about team performance, productivity, or individual contributions.",
            parameters: {
              type: "object",
              properties: {
                userId: {
                  type: "string",
                  description: "Specific team member ID to analyze (optional)"
                },
                userName: {
                  type: "string",
                  description: "Specific team member name to analyze (optional)"
                },
                timeframe: {
                  type: "string",
                  enum: ["week", "month", "quarter", "year"],
                  description: "Time period for analysis (default: month)"
                },
                metric: {
                  type: "string",
                  enum: ["tasks", "deals", "workload", "efficiency", "all"],
                  description: "Specific metric to analyze (default: all)"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_report",
            description: "Generate a custom report based on natural language request. Use when user asks for a report, summary, or data export.",
            parameters: {
              type: "object",
              properties: {
                reportType: {
                  type: "string",
                  enum: ["pipeline", "team", "deals", "tasks", "investors", "custom"],
                  description: "Type of report to generate"
                },
                title: {
                  type: "string",
                  description: "Title for the report"
                },
                requirements: {
                  type: "string",
                  description: "Natural language description of what the report should contain"
                },
                format: {
                  type: "string",
                  enum: ["summary", "detailed", "table"],
                  description: "Report format (default: summary)"
                }
              },
              required: ["reportType", "requirements"]
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
                    link: '/ceo/chat',
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
                    link: '/ceo/chat',
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
            } else if (functionCall?.name === "create_task") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const allUsers = await storage.getAllUsers();
                
                // Find assignee
                const assignee = allUsers.find(u => 
                  u.name.toLowerCase() === args.assigneeName.toLowerCase() ||
                  u.name.toLowerCase().includes(args.assigneeName.toLowerCase())
                );
                
                if (!assignee) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `User "${args.assigneeName}" not found. Available team members: ${allUsers.map(u => u.name).join(', ')}`
                  });
                  continue;
                }
                
                // Find deal if specified
                let dealId: string | undefined;
                if (args.dealName) {
                  const deal = deals.find(d => 
                    d.name.toLowerCase().includes(args.dealName.toLowerCase())
                  );
                  if (deal) dealId = deal.id;
                }
                
                // Create the task
                const task = await storage.createTask({
                  title: args.title,
                  type: 'General',
                  priority: args.priority || 'Medium',
                  status: 'Pending',
                  dueDate: args.dueDate,
                  assignedTo: assignee.id,
                  dealId: dealId,
                  createdBy: currentUser.id,
                });
                
                // Create notification for assignee
                await storage.createNotification({
                  userId: assignee.id,
                  title: 'New Task Assigned',
                  message: `${currentUser.name} assigned you: ${args.title}`,
                  type: 'info',
                  link: '/employee/my-tasks',
                });
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: `Task "${args.title}" created and assigned to ${assignee.name} with ${args.priority} priority, due ${args.dueDate}${dealId ? ` (linked to deal)` : ''}`
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to create task"
                });
              }
            } else if (functionCall?.name === "schedule_meeting") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const allUsers = await storage.getAllUsers();
                
                // Find attendees
                const attendeeNames = args.attendees || [];
                const foundAttendees: string[] = [];
                const notFoundAttendees: string[] = [];
                
                for (const name of attendeeNames) {
                  const user = allUsers.find(u => 
                    u.name.toLowerCase() === name.toLowerCase() ||
                    u.name.toLowerCase().includes(name.toLowerCase())
                  );
                  if (user) {
                    foundAttendees.push(user.name);
                  } else {
                    notFoundAttendees.push(name);
                  }
                }
                
                // Find deal if specified
                let dealId: string | undefined;
                if (args.dealName) {
                  const deal = deals.find(d => 
                    d.name.toLowerCase().includes(args.dealName.toLowerCase())
                  );
                  if (deal) dealId = deal.id;
                }
                
                // Create the meeting
                const meeting = await storage.createMeeting({
                  title: args.title,
                  date: args.date,
                  time: args.time,
                  attendees: foundAttendees,
                  location: args.location || 'TBD',
                  dealId: dealId,
                  description: args.description || '',
                  createdBy: currentUser.id,
                });
                
                // Notify attendees
                for (const attendeeName of foundAttendees) {
                  const attendee = allUsers.find(u => u.name === attendeeName);
                  if (attendee && attendee.id !== currentUser.id) {
                    await storage.createNotification({
                      userId: attendee.id,
                      title: 'Meeting Scheduled',
                      message: `${currentUser.name} scheduled: ${args.title} on ${args.date} at ${args.time}`,
                      type: 'info',
                      link: '/ceo/calendar',
                    });
                  }
                }
                
                let resultMsg = `Meeting "${args.title}" scheduled for ${args.date} at ${args.time} with ${foundAttendees.join(', ')}`;
                if (notFoundAttendees.length > 0) {
                  resultMsg += `. Note: Could not find users: ${notFoundAttendees.join(', ')}`;
                }
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: resultMsg
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to schedule meeting"
                });
              }
            } else if (functionCall?.name === "update_deal") {
              try {
                const args = JSON.parse(functionCall.arguments);
                
                // Find the deal
                const deal = deals.find(d => 
                  d.name.toLowerCase().includes(args.dealName.toLowerCase())
                );
                
                if (!deal) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `Deal "${args.dealName}" not found. Available deals: ${deals.slice(0, 5).map(d => d.name).join(', ')}...`
                  });
                  continue;
                }
                
                // Build updates
                const updates: any = {};
                if (args.stage) updates.stage = args.stage;
                if (args.status) updates.status = args.status;
                if (args.progress !== undefined) updates.progress = args.progress;
                
                if (Object.keys(updates).length === 0) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: "No updates specified for the deal"
                  });
                  continue;
                }
                
                // Update the deal
                await storage.updateDeal(deal.id, updates);
                
                const updatesList = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ');
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: `Deal "${deal.name}" updated: ${updatesList}`
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to update deal"
                });
              }
            } else if (functionCall?.name === "update_task") {
              try {
                const args = JSON.parse(functionCall.arguments);
                
                // Find the task
                const task = allTasks.find(t => 
                  t.title.toLowerCase().includes(args.taskTitle.toLowerCase())
                );
                
                if (!task) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `Task "${args.taskTitle}" not found. Try being more specific.`
                  });
                  continue;
                }
                
                // Build updates
                const updates: any = {};
                if (args.status) updates.status = args.status;
                if (args.priority) updates.priority = args.priority;
                
                if (Object.keys(updates).length === 0) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: "No updates specified for the task"
                  });
                  continue;
                }
                
                // Update the task
                await storage.updateTask(task.id, updates);
                
                const updatesList = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ');
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: `Task "${task.title}" updated: ${updatesList}`
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to update task"
                });
              }
            } else if (functionCall?.name === "generate_document") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const deal = args.dealName ? deals.find(d => d.name.toLowerCase().includes(args.dealName.toLowerCase())) : null;
                
                const documentTemplates: Record<string, string> = {
                  term_sheet: `# TERM SHEET\n\n**Transaction:** ${deal?.name || '[Deal Name]'}\n**Date:** ${new Date().toLocaleDateString()}\n\n## 1. PARTIES\n- **Company:** ${deal?.client || '[Client Name]'}\n- **Investor(s):** [Investor Names]\n\n## 2. INVESTMENT AMOUNT\n- **Total Investment:** $${deal?.value || '[Amount]'}M\n- **Type:** ${deal?.dealType || 'Equity'}\n\n## 3. VALUATION\n- **Pre-money Valuation:** $[X]M\n- **Post-money Valuation:** $[X]M\n\n## 4. KEY TERMS\n- **Board Seats:** [X] investor directors\n- **Protective Provisions:** Standard\n- **Information Rights:** Monthly financials, annual audit\n- **Anti-dilution:** Broad-based weighted average\n\n## 5. CONDITIONS PRECEDENT\n- Satisfactory due diligence\n- Definitive documentation\n- Regulatory approvals\n\n*This term sheet is non-binding except for confidentiality and exclusivity provisions.*`,
                  
                  nda: `# NON-DISCLOSURE AGREEMENT\n\n**Date:** ${new Date().toLocaleDateString()}\n\n**Between:**\n1. ${deal?.client || '[Disclosing Party]'} ("Disclosing Party")\n2. [Recipient Party] ("Receiving Party")\n\n## 1. DEFINITION OF CONFIDENTIAL INFORMATION\nAll information disclosed by the Disclosing Party relating to ${deal?.name || 'the Transaction'}, including but not limited to financial data, business plans, customer lists, and proprietary technology.\n\n## 2. OBLIGATIONS\nThe Receiving Party agrees to:\n- Maintain strict confidentiality\n- Use information solely for evaluating the Transaction\n- Limit disclosure to necessary personnel\n- Return or destroy materials upon request\n\n## 3. EXCLUSIONS\nInformation that is:\n- Publicly available\n- Previously known\n- Independently developed\n- Disclosed by authorized third parties\n\n## 4. TERM\nThis Agreement remains in effect for [2] years from the date above.\n\n**SIGNATURES:**\n\n_________________________\nDisclosing Party\n\n_________________________\nReceiving Party`,
                  
                  deal_memo: `# DEAL MEMORANDUM\n\n**Deal:** ${deal?.name || '[Deal Name]'}\n**Client:** ${deal?.client || '[Client]'}\n**Sector:** ${deal?.sector || '[Sector]'}\n**Date:** ${new Date().toLocaleDateString()}\n**Deal Lead:** ${deal?.lead || '[Lead Banker]'}\n\n## EXECUTIVE SUMMARY\n${deal?.description || '[Brief description of the transaction and its strategic rationale]'}\n\n## TRANSACTION OVERVIEW\n- **Deal Type:** ${deal?.dealType || 'M&A Advisory'}\n- **Transaction Value:** $${deal?.value || '[X]'}M\n- **Current Stage:** ${deal?.stage || 'Origination'}\n- **Expected Close:** [Date]\n\n## KEY CONSIDERATIONS\n1. **Strategic Fit:** [Analysis]\n2. **Market Conditions:** [Analysis]\n3. **Valuation:** [Analysis]\n4. **Risk Factors:** [Analysis]\n\n## NEXT STEPS\n1. [Action item 1]\n2. [Action item 2]\n3. [Action item 3]\n\n## TEAM\n- Deal Lead: ${deal?.lead || '[Name]'}\n- Associates: [Names]\n- Analysts: [Names]`,
                  
                  investor_update: `# INVESTOR UPDATE\n\n**Deal:** ${deal?.name || '[Deal Name]'}\n**Date:** ${new Date().toLocaleDateString()}\n**Update Period:** [Month/Quarter]\n\n## TRANSACTION STATUS\n**Current Stage:** ${deal?.stage || '[Stage]'}\n**Progress:** ${deal?.progress || 0}%\n\n## KEY DEVELOPMENTS\n1. [Development 1]\n2. [Development 2]\n3. [Development 3]\n\n## UPCOMING MILESTONES\n- [Milestone 1] - [Target Date]\n- [Milestone 2] - [Target Date]\n\n## ACTION ITEMS\n- [Item requiring investor attention]\n\n## NEXT COMMUNICATION\nWe will provide the next update on [Date].\n\nPlease reach out with any questions.`,
                  
                  email_draft: `Subject: ${deal?.name || '[Deal Name]'} - [Subject]\n\nDear ${args.recipientName || '[Recipient]'},\n\nI hope this email finds you well.\n\n[Body of email regarding ${deal?.name || 'the transaction'}]\n\nPlease let me know if you have any questions or would like to schedule a call to discuss further.\n\nBest regards,\n${currentUser.name}\nKronos Investment Banking`,
                  
                  loi: `# LETTER OF INTENT\n\n**Date:** ${new Date().toLocaleDateString()}\n\n**To:** ${deal?.client || '[Target Company]'}\n**From:** [Acquiring Party]\n**Re:** Proposed Transaction\n\nDear [Name],\n\nWe are pleased to submit this non-binding Letter of Intent to acquire ${deal?.client || '[Target]'}.\n\n## PROPOSED TERMS\n- **Purchase Price:** $${deal?.value || '[X]'}M\n- **Structure:** [Asset/Stock Purchase]\n- **Financing:** [Cash/Stock/Debt]\n\n## DUE DILIGENCE\nSubject to satisfactory completion of [30-60] day due diligence period.\n\n## EXCLUSIVITY\nWe request a [60] day exclusivity period.\n\n## CONFIDENTIALITY\nThis LOI and all discussions shall remain confidential.\n\n*This letter is non-binding except for exclusivity and confidentiality provisions.*\n\nSincerely,\n[Signature]`,
                  
                  due_diligence_checklist: `# DUE DILIGENCE CHECKLIST\n\n**Deal:** ${deal?.name || '[Deal Name]'}\n**Client:** ${deal?.client || '[Client]'}\n**Date:** ${new Date().toLocaleDateString()}\n\n## FINANCIAL\n- [ ] Audited financial statements (3 years)\n- [ ] Monthly financials (trailing 12 months)\n- [ ] Budget and projections\n- [ ] Accounts receivable aging\n- [ ] Accounts payable aging\n- [ ] Debt schedule and agreements\n\n## LEGAL\n- [ ] Corporate documents (charter, bylaws)\n- [ ] Shareholder agreements\n- [ ] Material contracts\n- [ ] Litigation history\n- [ ] Intellectual property\n- [ ] Regulatory compliance\n\n## OPERATIONS\n- [ ] Key customer list\n- [ ] Key supplier contracts\n- [ ] Employee roster and compensation\n- [ ] Real estate leases\n- [ ] Equipment list\n\n## TAX\n- [ ] Tax returns (3 years)\n- [ ] Tax notices and audits\n- [ ] Transfer pricing documentation\n\n## TECHNOLOGY\n- [ ] IT systems overview\n- [ ] Cybersecurity assessment\n- [ ] Data privacy compliance`,
                  
                  closing_checklist: `# CLOSING CHECKLIST\n\n**Deal:** ${deal?.name || '[Deal Name]'}\n**Target Close Date:** [Date]\n\n## PRE-CLOSING\n- [ ] Final due diligence complete\n- [ ] Purchase agreement negotiated and executed\n- [ ] Disclosure schedules finalized\n- [ ] Regulatory approvals obtained\n- [ ] Third-party consents received\n- [ ] Financing confirmed\n\n## CLOSING DAY\n- [ ] Bring-down of representations\n- [ ] Funds transfer verification\n- [ ] Signature pages collected\n- [ ] Certificate of closing\n- [ ] Press release approval\n\n## POST-CLOSING\n- [ ] File necessary documents\n- [ ] Transfer ownership records\n- [ ] Update corporate books\n- [ ] Integration kickoff\n- [ ] Stakeholder notifications`,
                  
                  pitch_deck_outline: `# PITCH DECK OUTLINE\n\n**Company:** ${deal?.client || '[Client Name]'}\n**Prepared for:** ${deal?.name || '[Transaction]'}\n\n## SLIDE 1: COVER\n- Company name and logo\n- Tagline/value proposition\n- Date and confidentiality notice\n\n## SLIDE 2: EXECUTIVE SUMMARY\n- Company overview\n- Transaction rationale\n- Key investment highlights\n\n## SLIDE 3: COMPANY OVERVIEW\n- Business description\n- History and milestones\n- Mission and vision\n\n## SLIDE 4: MARKET OPPORTUNITY\n- Total addressable market\n- Market trends\n- Competitive landscape\n\n## SLIDE 5: PRODUCTS/SERVICES\n- Product portfolio\n- Competitive advantages\n- Technology/IP\n\n## SLIDE 6: BUSINESS MODEL\n- Revenue streams\n- Customer segments\n- Go-to-market strategy\n\n## SLIDE 7: FINANCIAL HIGHLIGHTS\n- Historical performance\n- Key metrics and KPIs\n- Projections\n\n## SLIDE 8: MANAGEMENT TEAM\n- Key executives\n- Board of directors\n- Advisory board\n\n## SLIDE 9: INVESTMENT HIGHLIGHTS\n- Key strengths\n- Growth opportunities\n- Transaction value: $${deal?.value || '[X]'}M\n\n## SLIDE 10: APPENDIX\n- Detailed financials\n- Customer case studies\n- Additional data`
                };
                
                const docContent = documentTemplates[args.documentType] || "Document template not found";
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: `GENERATED_DOCUMENT_START\n${docContent}\nGENERATED_DOCUMENT_END\n\nDocument type: ${args.documentType.replace(/_/g, ' ').toUpperCase()}`
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to generate document"
                });
              }
            } else if (functionCall?.name === "get_deal_recommendation") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const deal = deals.find(d => d.name.toLowerCase().includes(args.dealName.toLowerCase()));
                
                if (!deal) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `Deal "${args.dealName}" not found.`
                  });
                  continue;
                }
                
                const stageRecommendations: Record<string, string[]> = {
                  'Origination': [
                    'Schedule initial client meeting to understand objectives',
                    'Prepare preliminary valuation analysis',
                    'Identify potential buyers/investors based on sector',
                    'Draft engagement letter and fee proposal',
                    'Conduct initial market assessment'
                  ],
                  'Qualification': [
                    'Complete preliminary due diligence',
                    'Validate deal economics and feasibility',
                    'Assess client financials and documentation',
                    'Identify key risk factors',
                    'Prepare internal deal committee memo'
                  ],
                  'Due Diligence': [
                    'Organize virtual data room',
                    'Coordinate management presentations',
                    'Address buyer/investor questions promptly',
                    'Track due diligence request list completion',
                    'Prepare for potential issues discovered'
                  ],
                  'Negotiation': [
                    'Review and markup transaction documents',
                    'Negotiate key commercial terms',
                    'Address open due diligence items',
                    'Prepare closing conditions checklist',
                    'Coordinate with legal counsel on documentation'
                  ],
                  'Documentation': [
                    'Finalize purchase agreement',
                    'Complete disclosure schedules',
                    'Obtain necessary third-party consents',
                    'Coordinate regulatory filings',
                    'Prepare closing mechanics'
                  ],
                  'Closing': [
                    'Confirm all closing conditions satisfied',
                    'Coordinate funds flow',
                    'Execute signature pages',
                    'Prepare announcement materials',
                    'Plan post-closing integration'
                  ]
                };
                
                const recommendations = stageRecommendations[deal.stage] || stageRecommendations['Origination'];
                const dealTasks = allTasks.filter(t => t.dealId === deal.id);
                const openTasks = dealTasks.filter(t => t.status !== 'Completed');
                const overdueTasks = dealTasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'Completed');
                
                const recommendation = `
DEAL ANALYSIS: ${deal.name}
Current Stage: ${deal.stage}
Progress: ${deal.progress}%
Value: $${deal.value}M

CURRENT STATUS:
- Open Tasks: ${openTasks.length}
- Overdue Tasks: ${overdueTasks.length}
${overdueTasks.length > 0 ? `- ⚠️ Overdue: ${overdueTasks.map(t => t.title).join(', ')}` : ''}

RECOMMENDED NEXT STEPS FOR ${deal.stage.toUpperCase()} STAGE:
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

PRIORITY ACTIONS:
${deal.progress < 25 ? '🔴 Deal is early stage - focus on building momentum' : deal.progress < 50 ? '🟡 Mid-process - maintain timeline discipline' : deal.progress < 75 ? '🟢 Good progress - push toward completion' : '🎯 Final stretch - ensure all conditions are met'}
                `;
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: recommendation
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to analyze deal"
                });
              }
            } else if (functionCall?.name === "analyze_investor_fit") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const deal = deals.find(d => d.name.toLowerCase().includes(args.dealName.toLowerCase()));
                
                if (!deal) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `Deal "${args.dealName}" not found.`
                  });
                  continue;
                }
                
                const limit = args.limit || 5;
                const dealSector = deal.sector?.toLowerCase() || '';
                
                // Score investors based on sector match
                const scoredInvestors = investors
                  .filter(inv => inv.status === 'Active')
                  .map(inv => {
                    let score = 0;
                    const invSectors = (inv.preferredSectors || []).map(s => s.toLowerCase());
                    const invFocus = inv.focus?.toLowerCase() || '';
                    
                    // Exact sector match
                    if (invSectors.includes(dealSector) || invFocus.includes(dealSector)) {
                      score += 50;
                    }
                    // Partial match
                    if (invSectors.some(s => dealSector.includes(s) || s.includes(dealSector))) {
                      score += 30;
                    }
                    // Check size fit
                    if (inv.minInvestment && inv.maxInvestment) {
                      if (deal.value >= inv.minInvestment && deal.value <= inv.maxInvestment) {
                        score += 40;
                      } else if (deal.value >= inv.minInvestment * 0.5 && deal.value <= inv.maxInvestment * 1.5) {
                        score += 20;
                      }
                    }
                    // Favorite bonus
                    if (inv.isFavorite) score += 10;
                    
                    return { ...inv, score };
                  })
                  .filter(inv => inv.score > 0)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, limit);
                
                if (scoredInvestors.length === 0) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `No matching investors found for ${deal.name} (${deal.sector} sector). Consider expanding your investor database.`
                  });
                  continue;
                }
                
                const analysis = `
INVESTOR ANALYSIS FOR: ${deal.name}
Sector: ${deal.sector}
Deal Size: $${deal.value}M

TOP ${scoredInvestors.length} RECOMMENDED INVESTORS:
${scoredInvestors.map((inv, i) => `
${i + 1}. ${inv.name} (Match Score: ${inv.score}%)
   Type: ${inv.type}
   Focus: ${inv.focus || 'Multi-sector'}
   Investment Range: $${inv.minInvestment || 0}M - $${inv.maxInvestment || '∞'}M
   AUM: ${inv.aum ? `$${inv.aum}B` : 'N/A'}
`).join('')}

RECOMMENDATION: Start outreach with ${scoredInvestors[0]?.name} - highest match score based on sector alignment and investment criteria.
                `;
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: analysis
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to analyze investor fit"
                });
              }
            } else if (functionCall?.name === "get_market_data") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const symbol = args.symbol.toUpperCase();
                const includeNews = args.includeNews ?? false;
                
                const finnhubKey = process.env.FINNHUB_API_KEY;
                if (!finnhubKey) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: "Market data service is not configured. Please add FINNHUB_API_KEY."
                  });
                  continue;
                }
                
                // Fetch quote data
                const quoteResponse = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
                const quoteData = await quoteResponse.json() as any;
                
                let result = `
MARKET DATA FOR: ${symbol}
Current Price: $${quoteData.c?.toFixed(2) || 'N/A'}
Change: ${quoteData.d >= 0 ? '+' : ''}${quoteData.d?.toFixed(2) || 'N/A'} (${quoteData.dp >= 0 ? '+' : ''}${quoteData.dp?.toFixed(2) || 'N/A'}%)
High: $${quoteData.h?.toFixed(2) || 'N/A'}
Low: $${quoteData.l?.toFixed(2) || 'N/A'}
Open: $${quoteData.o?.toFixed(2) || 'N/A'}
Previous Close: $${quoteData.pc?.toFixed(2) || 'N/A'}
`;
                
                // Fetch news if requested
                if (includeNews) {
                  const today = new Date().toISOString().split('T')[0];
                  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  const newsResponse = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${weekAgo}&to=${today}&token=${finnhubKey}`);
                  const newsData = await newsResponse.json() as any[];
                  
                  if (newsData && newsData.length > 0) {
                    result += `
RECENT NEWS:
${newsData.slice(0, 5).map((n, i) => `${i + 1}. ${n.headline} (${new Date(n.datetime * 1000).toLocaleDateString()})`).join('\n')}
`;
                  }
                }
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to fetch market data"
                });
              }
            } else if (functionCall?.name === "summarize_document") {
              try {
                const args = JSON.parse(functionCall.arguments);
                let document: any;
                
                if (args.documentId) {
                  document = await storage.getDocument(args.documentId);
                } else if (args.documentName) {
                  const allDocs = await storage.getAllDocuments();
                  document = allDocs.find(d => d.filename.toLowerCase().includes(args.documentName.toLowerCase()));
                }
                
                if (!document) {
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: "Document not found. Please specify a valid document ID or name."
                  });
                  continue;
                }
                
                const summaryType = args.summaryType || 'brief';
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: `
DOCUMENT SUMMARY: ${document.filename}
Category: ${document.category || 'Uncategorized'}
Deal: ${document.dealId ? deals.find(d => d.id === document.dealId)?.name || 'Unknown' : 'N/A'}
Tags: ${document.tags?.join(', ') || 'None'}
Uploaded: ${document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'Unknown'}

This is a ${document.category || 'general'} document. To get a full content summary, the document text would need to be processed by the AI. Currently showing metadata summary.
`
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to summarize document"
                });
              }
            } else if (functionCall?.name === "generate_meeting_prep") {
              try {
                const args = JSON.parse(functionCall.arguments);
                let meeting: any;
                
                if (args.meetingId) {
                  meeting = meetings.find(m => m.id === args.meetingId);
                } else if (args.meetingTitle) {
                  meeting = meetings.find(m => m.title.toLowerCase().includes(args.meetingTitle.toLowerCase()));
                }
                
                if (!meeting) {
                  const upcomingList = meetings
                    .filter(m => new Date(m.date) >= now)
                    .slice(0, 5)
                    .map(m => `- ${m.title} (${new Date(m.date).toLocaleDateString()})`)
                    .join('\n');
                  toolResults.push({
                    tool_call_id: toolCall.id,
                    result: `Meeting not found. Upcoming meetings:\n${upcomingList}`
                  });
                  continue;
                }
                
                // Get related deal if any
                const relatedDeal = meeting.dealId ? deals.find(d => d.id === meeting.dealId) : null;
                const dealTasks = relatedDeal ? allTasks.filter(t => t.dealId === relatedDeal.id) : [];
                const dealDocs = relatedDeal ? documents.filter(d => d.dealId === relatedDeal.id) : [];
                
                const prep = `
MEETING PREPARATION: ${meeting.title}
Date: ${new Date(meeting.date).toLocaleDateString()} at ${meeting.time}
Location: ${meeting.location || 'TBD'}
Attendees: ${meeting.attendees?.join(', ') || 'TBD'}

SUGGESTED AGENDA:
1. Opening and introductions (5 min)
2. Review of key topics and objectives (10 min)
3. Main discussion points (30 min)
4. Action items and next steps (10 min)
5. Q&A and closing (5 min)

${relatedDeal ? `
DEAL CONTEXT: ${relatedDeal.name}
Stage: ${relatedDeal.stage}
Progress: ${relatedDeal.progress}%
Value: $${relatedDeal.value}M
Open Tasks: ${dealTasks.filter(t => t.status !== 'Completed').length}
Documents: ${dealDocs.length}
` : ''}

TALKING POINTS:
• Review progress since last meeting
• Discuss any blockers or concerns
• Align on priorities and timelines
• Confirm next steps and responsibilities

PREPARATION CHECKLIST:
☐ Review relevant documents
☐ Prepare status update
☐ List questions/concerns to address
☐ Have data/metrics ready to share
`;
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: prep
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to generate meeting prep"
                });
              }
            } else if (functionCall?.name === "get_pipeline_analytics") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const timeframe = args.timeframe || 'quarter';
                const sectorFilter = args.sector?.toLowerCase();
                
                // Calculate timeframe dates
                const timeframes: Record<string, number> = {
                  week: 7,
                  month: 30,
                  quarter: 90,
                  year: 365,
                  all: 10000
                };
                const daysBack = timeframes[timeframe] || 90;
                const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
                
                // Filter deals by timeframe
                let filteredDeals = deals.filter(d => {
                  const created = d.createdAt ? new Date(d.createdAt) : now;
                  return created >= cutoffDate;
                });
                
                if (sectorFilter) {
                  filteredDeals = filteredDeals.filter(d => d.sector?.toLowerCase().includes(sectorFilter));
                }
                
                // Calculate metrics
                const totalValue = filteredDeals.reduce((sum, d) => sum + d.value, 0);
                const avgValue = filteredDeals.length > 0 ? totalValue / filteredDeals.length : 0;
                const wonDeals = filteredDeals.filter(d => d.status === 'Won' || d.status === 'Closed');
                const winRate = filteredDeals.length > 0 ? (wonDeals.length / filteredDeals.length * 100) : 0;
                
                // Stage distribution
                const stageDistribution = filteredDeals.reduce((acc, d) => {
                  acc[d.stage] = (acc[d.stage] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                
                // Sector breakdown
                const sectorBreakdown = filteredDeals.reduce((acc, d) => {
                  const sector = d.sector || 'Other';
                  acc[sector] = (acc[sector] || { count: 0, value: 0 });
                  acc[sector].count++;
                  acc[sector].value += d.value;
                  return acc;
                }, {} as Record<string, { count: number; value: number }>);
                
                const analytics = `
PIPELINE ANALYTICS (${timeframe.toUpperCase()})
${sectorFilter ? `Sector: ${sectorFilter}\n` : ''}
OVERVIEW:
Total Deals: ${filteredDeals.length}
Total Pipeline Value: $${totalValue.toFixed(1)}M
Average Deal Size: $${avgValue.toFixed(1)}M
Win Rate: ${winRate.toFixed(1)}%

STAGE DISTRIBUTION:
${Object.entries(stageDistribution).map(([stage, count]) => `• ${stage}: ${count} deals (${(count/filteredDeals.length*100).toFixed(0)}%)`).join('\n')}

SECTOR BREAKDOWN:
${Object.entries(sectorBreakdown).map(([sector, data]) => `• ${sector}: ${data.count} deals, $${data.value.toFixed(1)}M`).join('\n')}

KEY INSIGHTS:
${filteredDeals.filter(d => d.progress >= 75).length > 0 ? `🎯 ${filteredDeals.filter(d => d.progress >= 75).length} deals near completion (75%+ progress)` : ''}
${stalledDeals.length > 0 ? `⚠️ ${stalledDeals.length} stalled deals need attention` : '✅ No stalled deals'}
`;
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: analytics
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to generate pipeline analytics"
                });
              }
            } else if (functionCall?.name === "get_team_performance") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const timeframe = args.timeframe || 'month';
                
                const timeframes: Record<string, number> = {
                  week: 7,
                  month: 30,
                  quarter: 90,
                  year: 365
                };
                const daysBack = timeframes[timeframe] || 30;
                const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
                
                // Filter to specific user if requested
                let targetUsers = users;
                if (args.userName) {
                  targetUsers = users.filter(u => u.name.toLowerCase().includes(args.userName.toLowerCase()));
                } else if (args.userId) {
                  targetUsers = users.filter(u => u.id === args.userId);
                }
                
                const performanceData = targetUsers.map(u => {
                  const userTasks = allTasks.filter(t => t.assignedTo === u.id);
                  const completedTasks = userTasks.filter(t => t.status === 'Completed' && t.updatedAt && new Date(t.updatedAt) >= cutoffDate);
                  const activeTasks = userTasks.filter(t => t.status !== 'Completed');
                  const overdueTasks = userTasks.filter(t => new Date(t.dueDate) < now && t.status !== 'Completed');
                  const userDeals = deals.filter(d => d.lead === u.name);
                  
                  return {
                    name: u.name,
                    role: u.role,
                    completedTasks: completedTasks.length,
                    activeTasks: activeTasks.length,
                    overdueTasks: overdueTasks.length,
                    activeDeals: userDeals.filter(d => d.status === 'Active').length,
                    efficiency: userTasks.length > 0 ? (completedTasks.length / userTasks.length * 100) : 0,
                    workloadScore: activeTasks.length + (overdueTasks.length * 2),
                  };
                }).sort((a, b) => b.efficiency - a.efficiency);
                
                const performance = `
TEAM PERFORMANCE (${timeframe.toUpperCase()})

${performanceData.map(p => `
${p.name} (${p.role})
  ✅ Completed: ${p.completedTasks} tasks
  📋 Active: ${p.activeTasks} tasks
  ${p.overdueTasks > 0 ? `⚠️ Overdue: ${p.overdueTasks} tasks` : '✔️ No overdue tasks'}
  💼 Active Deals: ${p.activeDeals}
  📊 Efficiency: ${p.efficiency.toFixed(0)}%
  🔥 Workload Score: ${p.workloadScore} ${p.workloadScore > 10 ? '(HIGH)' : p.workloadScore > 5 ? '(MODERATE)' : '(LOW)'}
`).join('\n')}

SUMMARY:
• Highest Performer: ${performanceData[0]?.name || 'N/A'} (${performanceData[0]?.efficiency.toFixed(0) || 0}% efficiency)
• Total Completed Tasks: ${performanceData.reduce((sum, p) => sum + p.completedTasks, 0)}
• Team Capacity: ${performanceData.filter(p => p.workloadScore <= 5).length} members with available capacity
`;
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: performance
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to generate team performance"
                });
              }
            } else if (functionCall?.name === "generate_report") {
              try {
                const args = JSON.parse(functionCall.arguments);
                const reportType = args.reportType;
                const format = args.format || 'summary';
                const title = args.title || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
                
                let reportContent = `
# ${title}
Generated: ${new Date().toLocaleString()}
Report Type: ${reportType}

`;
                
                switch (reportType) {
                  case 'pipeline':
                    reportContent += `
## Pipeline Overview
- Total Deals: ${deals.length}
- Active: ${deals.filter(d => d.status === 'Active').length}
- Won/Closed: ${deals.filter(d => d.status === 'Won' || d.status === 'Closed').length}
- Total Value: $${deals.reduce((sum, d) => sum + d.value, 0).toFixed(1)}M

## Stage Distribution
${Object.entries(dealsByStage).map(([stage, count]) => `- ${stage}: ${count}`).join('\n')}
`;
                    break;
                  case 'team':
                    reportContent += `
## Team Summary
- Total Members: ${users.length}
- Active Tasks: ${allTasks.filter(t => t.status !== 'Completed').length}
- Overdue Tasks: ${allOverdueTasks.length}

## Workload Distribution
${teamWorkload.slice(0, 10).map(m => `- ${m.name}: ${m.activeTasks} active, ${m.overdueTasks} overdue`).join('\n')}
`;
                    break;
                  case 'deals':
                    reportContent += `
## Deals Summary
${deals.slice(0, 10).map(d => `
### ${d.name}
- Client: ${d.client}
- Sector: ${d.sector}
- Stage: ${d.stage}
- Value: $${d.value}M
- Progress: ${d.progress}%
`).join('\n')}
`;
                    break;
                  case 'tasks':
                    reportContent += `
## Tasks Summary
- Total Tasks: ${allTasks.length}
- Pending: ${allTasks.filter(t => t.status === 'Pending').length}
- In Progress: ${allTasks.filter(t => t.status === 'In Progress').length}
- Completed: ${allTasks.filter(t => t.status === 'Completed').length}
- Overdue: ${allOverdueTasks.length}

## Upcoming Deadlines
${upcomingDeadlines.slice(0, 10).map(t => `- ${t.title} (Due: ${new Date(t.dueDate).toLocaleDateString()})`).join('\n')}
`;
                    break;
                  case 'investors':
                    reportContent += `
## Investor Summary
- Total Investors: ${investors.length}
- Active: ${investors.filter(i => i.status === 'Active').length}

## By Type
${Object.entries(investors.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([type, count]) => `- ${type}: ${count}`).join('\n')}
`;
                    break;
                  default:
                    reportContent += `Custom report based on: ${args.requirements}\n\nNote: For custom reports, please be more specific about what data you need.`;
                }
                
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: reportContent
                });
              } catch (parseError) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  result: "Failed to generate report"
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
  app.get("/api/chat/conversations", requireAuth, requireInternal, async (req, res) => {
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
  app.post("/api/chat/conversations", requireAuth, requireInternal, async (req, res) => {
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
  app.get("/api/chat/conversations/:id/messages", requireAuth, requireInternal, async (req, res) => {
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
      const { content, attachments, mentionedUserIds, replyToMessageId } = req.body;
      
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
        replyToMessageId: replyToMessageId || null,
      });
      
      // Create notifications for mentioned users first (higher priority)
      // Validate mentioned users are actual conversation members for security
      const memberIds = new Set(members.map(m => m.userId));
      const validMentionedIds = (mentionedUserIds || []).filter((id: string) => memberIds.has(id));
      const mentionedSet = new Set(validMentionedIds);
      
      for (const mentionedUserId of mentionedSet) {
        if (mentionedUserId !== currentUser.id) {
          await storage.createNotification({
            userId: mentionedUserId,
            title: 'You were mentioned',
            message: `${currentUser.name} mentioned you: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
            type: 'alert',
            link: '/ceo/chat',
          });
        }
      }
      
      // Create regular notifications for other non-mentioned members
      for (const member of members) {
        if (member.userId !== currentUser.id && !mentionedSet.has(member.userId)) {
          await storage.createNotification({
            userId: member.userId,
            title: 'New Message',
            message: `${currentUser.name}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
            type: 'info',
            link: '/ceo/chat',
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

  // Delete (unsend) a message - only the sender can delete their own messages
  app.delete("/api/chat/conversations/:conversationId/messages/:messageId", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { conversationId, messageId } = req.params;
      
      // Verify conversation exists and user is a member
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const members = await storage.getConversationMembers(conversationId);
      if (!members.some(m => m.userId === currentUser.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Verify message exists and belongs to this conversation
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      if (message.conversationId !== conversationId) {
        return res.status(400).json({ error: "Message does not belong to this conversation" });
      }
      
      // Only the sender can delete their own message
      if (message.senderId !== currentUser.id) {
        return res.status(403).json({ error: "You can only unsend your own messages" });
      }
      
      await storage.deleteMessage(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });
  
  // Add reaction to a message
  app.post("/api/chat/conversations/:conversationId/messages/:messageId/reactions", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { conversationId, messageId } = req.params;
      const { emoji } = req.body;
      
      if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      // Verify conversation exists and user is a member
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const members = await storage.getConversationMembers(conversationId);
      if (!members.some(m => m.userId === currentUser.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Verify message exists
      const message = await storage.getMessage(messageId);
      if (!message || message.conversationId !== conversationId) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Add reaction
      const reactions = (message.reactions || []) as any[];
      const existingIndex = reactions.findIndex(r => r.userId === currentUser.id && r.emoji === emoji);
      
      if (existingIndex >= 0) {
        // Remove reaction if already exists (toggle)
        reactions.splice(existingIndex, 1);
      } else {
        // Add new reaction
        reactions.push({
          emoji,
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: new Date().toISOString(),
        });
      }
      
      const updated = await storage.updateMessage(messageId, { reactions });
      res.json(updated);
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });
  
  // Update chat conversation (name)
  app.patch("/api/chat/conversations/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { name } = req.body;
      const conversation = await storage.getConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Verify user is a member
      const members = await storage.getConversationMembers(req.params.id);
      if (!members.some(m => m.userId === currentUser.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const updated = await storage.updateConversation(req.params.id, { name: name.trim() });
      res.json(updated);
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // Delete chat conversation
  app.delete("/api/chat/conversations/:id", requireAuth, async (req, res) => {
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
      
      // Delete all messages first, then members, then conversation
      await storage.deleteConversationMessages(req.params.id);
      await storage.deleteConversationMembers(req.params.id);
      await storage.deleteConversation(req.params.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: "Failed to delete conversation" });
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
        link: '/ceo/chat',
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
  
  // Get all time entries (admin sees all, others see their own)
  app.get("/api/time-entries", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      let entries;
      if (user.accessLevel === 'admin') {
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
      if (entry.userId !== user.id && user.accessLevel !== 'admin') {
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
      if (entry.userId !== user.id && user.accessLevel !== 'admin') {
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
      if (user.accessLevel === 'admin') {
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
      
      // Admin can approve/reject
      if (req.body.status && user.accessLevel === 'admin') {
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
        
        // Send notification to the employee
        const isApproved = req.body.status === 'Approved';
        await storage.createNotification({
          userId: request.userId,
          type: isApproved ? 'success' : 'alert',
          title: `Time Off ${req.body.status}`,
          message: `Your ${request.type} request from ${request.startDate} to ${request.endDate} has been ${req.body.status.toLowerCase()}.`,
          link: '/employee/calendar',
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
      if (request.userId !== user.id && user.accessLevel !== 'admin') {
        return res.status(403).json({ error: "Not authorized to delete this request" });
      }
      
      await storage.deleteTimeOffRequest(req.params.id);
      res.json({ message: "Time off request deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time off request" });
    }
  });
  
  // ===== AUDIT LOG ROUTES =====
  
  // Get audit logs (all authenticated users - CEOs see all, employees see their own)
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
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
      
      // Admins see all logs, others see only their own activities
      const filteredLogs = user.accessLevel === 'admin' 
        ? enrichedLogs 
        : enrichedLogs.filter((log: any) => log.userId === user.id);
      
      res.json(filteredLogs);
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
  app.post("/api/investors", generalLimiter, requireCEO, async (req, res) => {
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

  // ===== OKR ROUTES =====
  
  // Get all OKRs
  app.get("/api/okrs", requireAuth, async (req, res) => {
    try {
      const okrs = await storage.getAllOkrs();
      res.json(okrs);
    } catch (error) {
      console.error('Get OKRs error:', error);
      res.status(500).json({ error: "Failed to fetch OKRs" });
    }
  });
  
  // Get single OKR
  app.get("/api/okrs/:id", requireAuth, async (req, res) => {
    try {
      const okr = await storage.getOkr(req.params.id);
      if (!okr) {
        return res.status(404).json({ error: "OKR not found" });
      }
      res.json(okr);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch OKR" });
    }
  });
  
  // Create OKR
  app.post("/api/okrs", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertOkrSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const okr = await storage.createOkr(result.data);
      res.status(201).json(okr);
    } catch (error) {
      console.error('Create OKR error:', error);
      res.status(500).json({ error: "Failed to create OKR" });
    }
  });
  
  // Update OKR
  app.patch("/api/okrs/:id", requireAuth, async (req, res) => {
    try {
      const okr = await storage.getOkr(req.params.id);
      if (!okr) {
        return res.status(404).json({ error: "OKR not found" });
      }
      const updated = await storage.updateOkr(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update OKR" });
    }
  });
  
  // Delete OKR
  app.delete("/api/okrs/:id", requireAuth, async (req, res) => {
    try {
      const okr = await storage.getOkr(req.params.id);
      if (!okr) {
        return res.status(404).json({ error: "OKR not found" });
      }
      await storage.deleteOkr(req.params.id);
      res.json({ message: "OKR deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete OKR" });
    }
  });

  // ===== STAKEHOLDER ROUTES =====
  
  // Get all stakeholders
  app.get("/api/stakeholders", requireAuth, async (req, res) => {
    try {
      // Support pagination via query params with safe defaults
      const rawPage = parseInt(req.query.page as string);
      const rawPageSize = parseInt(req.query.pageSize as string);
      const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
      const pageSize = Math.max(1, Math.min(isNaN(rawPageSize) ? 50 : rawPageSize, 100));
      const search = req.query.search as string | undefined;
      const type = req.query.type as string | undefined;
      
      // If no pagination params, use paginated with defaults for better performance
      const result = await storage.getStakeholdersPaginated({
        page,
        pageSize,
        search,
        type
      });
      
      res.json({
        stakeholders: result.stakeholders,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize)
      });
    } catch (error) {
      console.error('Get stakeholders error:', error);
      res.status(500).json({ error: "Failed to fetch stakeholders" });
    }
  });
  
  // Get stakeholder stats (total counts by type)
  app.get("/api/stakeholders/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getStakeholderStats();
      res.json(stats);
    } catch (error) {
      console.error('Get stakeholder stats error:', error);
      res.status(500).json({ error: "Failed to fetch stakeholder stats" });
    }
  });
  
  // Get single stakeholder
  app.get("/api/stakeholders/:id", requireAuth, async (req, res) => {
    try {
      const stakeholder = await storage.getStakeholder(req.params.id);
      if (!stakeholder) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      res.json(stakeholder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stakeholder" });
    }
  });
  
  // Create stakeholder
  app.post("/api/stakeholders", generalLimiter, requireAuth, async (req, res) => {
    try {
      const result = insertStakeholderSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const stakeholder = await storage.createStakeholder(result.data);
      res.status(201).json(stakeholder);
    } catch (error) {
      console.error('Create stakeholder error:', error);
      res.status(500).json({ error: "Failed to create stakeholder" });
    }
  });
  
  // Parse Excel/CSV file for import (server-side to avoid UI freeze)
  app.post("/api/stakeholders/parse-file", generalLimiter, requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      
      console.log(`Parsing file: ${req.file.originalname}, size: ${req.file.size} bytes`);
      
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];
      
      // Sanitize string values
      const sanitizeValue = (val: any): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
      };
      
      if (ext === '.xlsx' || ext === '.xls') {
        // Parse Excel file - read as buffer first
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });
        
        if (jsonData.length === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: "File is empty or has no data rows" });
        }
        
        headers = Object.keys(jsonData[0]).map(h => sanitizeValue(h));
        rows = jsonData.map(row => {
          const sanitizedRow: Record<string, string> = {};
          headers.forEach((header, i) => {
            const originalKey = Object.keys(jsonData[0])[i];
            sanitizedRow[header] = sanitizeValue(row[originalKey]);
          });
          return sanitizedRow;
        }).filter(row => Object.values(row).some(v => v));
      } else if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
        // Parse CSV/TSV file
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: "File is empty" });
        }
        
        const delimiter = content.includes('\t') ? '\t' : ',';
        headers = lines[0].split(delimiter).map(h => sanitizeValue(h.replace(/^"|"$/g, '')));
        
        rows = lines.slice(1).map(line => {
          const values = line.split(delimiter).map(v => sanitizeValue(v.replace(/^"|"$/g, '')));
          const row: Record<string, string> = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        }).filter(row => Object.values(row).some(v => v));
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "Unsupported file format" });
      }
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      console.log(`Parsed ${rows.length} rows with ${headers.length} columns`);
      console.log('Headers:', headers);
      if (rows.length > 0) {
        console.log('Sample row keys:', Object.keys(rows[0]));
        console.log('Sample row:', rows[0]);
      }
      
      res.json({
        headers,
        rows,
        totalRows: rows.length
      });
    } catch (error) {
      console.error('Parse file error:', error);
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to parse file" });
    }
  });
  
  // Bulk import stakeholders
  app.post("/api/stakeholders/bulk-import", generalLimiter, requireAuth, async (req, res) => {
    try {
      const { stakeholders } = req.body;
      
      if (!Array.isArray(stakeholders) || stakeholders.length === 0) {
        return res.status(400).json({ error: "stakeholders array is required" });
      }
      
      console.log(`Bulk importing ${stakeholders.length} stakeholders...`);
      
      const validTypes = ['investor', 'advisor', 'legal', 'banker', 'consultant', 'client', 'other'];
      let successCount = 0;
      let errorCount = 0;
      const created = [];
      
      for (const s of stakeholders) {
        if (!s.name || !s.company) {
          errorCount++;
          continue;
        }
        
        try {
          const stakeholderType = validTypes.includes(s.type?.toLowerCase()) ? s.type.toLowerCase() : 'other';
          
          const result = await storage.createStakeholder({
            name: s.name,
            title: s.title || '',
            company: s.company,
            type: stakeholderType,
            email: s.email || null,
            phone: s.phone || null,
            linkedin: s.linkedin || null,
            website: s.website || null,
            location: s.location || null,
            focus: s.focus || null,
            notes: s.notes || null,
            deals: [],
            isFavorite: false
          });
          created.push(result);
          successCount++;
        } catch (err) {
          console.error('Failed to create stakeholder:', s.name, err);
          errorCount++;
        }
      }
      
      console.log(`Bulk import complete: ${successCount} created, ${errorCount} failed`);
      
      res.status(201).json({
        successCount,
        errorCount,
        totalProcessed: stakeholders.length,
        created
      });
    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ error: "Failed to bulk import stakeholders" });
    }
  });
  
  // Update stakeholder
  app.patch("/api/stakeholders/:id", requireAuth, async (req, res) => {
    try {
      const stakeholder = await storage.getStakeholder(req.params.id);
      if (!stakeholder) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      const updated = await storage.updateStakeholder(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stakeholder" });
    }
  });
  
  // Delete stakeholder
  app.delete("/api/stakeholders/:id", requireAuth, async (req, res) => {
    try {
      const stakeholder = await storage.getStakeholder(req.params.id);
      if (!stakeholder) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      await storage.deleteStakeholder(req.params.id);
      res.json({ message: "Stakeholder deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stakeholder" });
    }
  });
  
  // Scan document to extract ALL stakeholder information using AI and auto-create them
  app.post("/api/stakeholders/scan-document", aiLimiter, requireAuth, async (req, res) => {
    try {
      const { documentContent, filename, autoCreate } = req.body;
      
      if (!documentContent) {
        return res.status(400).json({ error: "Document content is required" });
      }
      
      console.log(`Scanning document: ${filename}, content length: ${documentContent.length} chars`);
      
      // Split CSV content into chunks to handle large files
      const lines = documentContent.split('\n');
      const headerLine = lines[0];
      const dataLines = lines.slice(1).filter((line: string) => line.trim());
      const CHUNK_SIZE = 75; // Process 75 rows at a time for reliability
      
      console.log(`Document has ${dataLines.length} data rows, processing in chunks of ${CHUNK_SIZE}`);
      
      const allStakeholders: any[] = [];
      const chunks = [];
      
      // Create chunks with header included
      for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
        const chunkLines = dataLines.slice(i, i + CHUNK_SIZE);
        chunks.push(headerLine + '\n' + chunkLines.join('\n'));
      }
      
      console.log(`Processing ${chunks.length} chunks...`);
      
      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length}...`);
        
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an expert at extracting stakeholder/contact information from CSV/spreadsheet data.

INSTRUCTIONS:
1. Process EVERY ROW in this CSV chunk
2. Each row is a separate stakeholder entry
3. Map column values to stakeholder fields

Column mapping:
- Name/Contact Name/Full Name/Person -> name
- Company/Firm/Organization/Fund -> company
- Title/Position/Role -> title
- Email/E-mail -> email
- Phone/Tel/Mobile -> phone
- Focus/Sector/Industry -> focus (extract as comma-separated list)
- Location/City/Region -> location
- Type/Category -> type (investor/advisor/legal/banker/consultant/client/other)
- Website/URL -> website
- LinkedIn -> linkedin
- Notes/Comments -> notes

Return JSON: {"stakeholders": [{name, title, company, type, email, phone, linkedin, website, location, focus, notes}, ...]}
Only include entries with both name AND company. Extract ALL rows.`
              },
              {
                role: "user",
                content: `Extract ALL contacts from this CSV chunk (chunk ${chunkIndex + 1} of ${chunks.length}):\n\n${chunk}`
              }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 8192
          });
          
          const content = response.choices[0]?.message?.content;
          if (content) {
            try {
              const extracted = JSON.parse(content);
              if (extracted.stakeholders && Array.isArray(extracted.stakeholders)) {
                allStakeholders.push(...extracted.stakeholders);
                console.log(`Chunk ${chunkIndex + 1}: extracted ${extracted.stakeholders.length} stakeholders`);
              }
            } catch (parseErr) {
              console.error(`Failed to parse chunk ${chunkIndex + 1}:`, parseErr);
            }
          }
        } catch (chunkError: any) {
          console.error(`Error processing chunk ${chunkIndex + 1}:`, chunkError?.message);
        }
      }
      
      console.log(`Total extracted: ${allStakeholders.length} stakeholders from ${chunks.length} chunks`);
      
      const stakeholders = allStakeholders;
      
      // If autoCreate is true, create all stakeholders in the database
      if (autoCreate && stakeholders.length > 0) {
        const validTypes = ['investor', 'advisor', 'legal', 'banker', 'consultant', 'client', 'other'];
        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        const createdStakeholders = [];
        const skippedReasons: string[] = [];
        
        for (const s of stakeholders) {
          // Skip entries without required fields
          if (!s.name || typeof s.name !== 'string' || s.name.trim() === '') {
            skippedCount++;
            skippedReasons.push(`Missing name: ${JSON.stringify(s).slice(0, 50)}...`);
            continue;
          }
          if (!s.company || typeof s.company !== 'string' || s.company.trim() === '') {
            skippedCount++;
            skippedReasons.push(`Missing company for "${s.name}"`);
            continue;
          }
          
          try {
            const stakeholderType = validTypes.includes(s.type?.toLowerCase()) ? s.type.toLowerCase() : 'other';
            
            // Sanitize all optional fields - convert empty strings to null
            const sanitizeOptional = (val: any): string | null => {
              if (!val || typeof val !== 'string' || val.trim() === '') return null;
              return val.trim();
            };
            
            const created = await storage.createStakeholder({
              name: s.name.trim(),
              title: sanitizeOptional(s.title) || '',
              company: s.company.trim(),
              type: stakeholderType,
              email: sanitizeOptional(s.email),
              phone: sanitizeOptional(s.phone),
              linkedin: sanitizeOptional(s.linkedin),
              website: sanitizeOptional(s.website),
              location: sanitizeOptional(s.location),
              focus: sanitizeOptional(s.focus),
              notes: sanitizeOptional(s.notes),
              deals: [],
              isFavorite: false
            });
            createdStakeholders.push(created);
            successCount++;
          } catch (err) {
            console.error('Failed to create stakeholder:', s.name, err);
            failedCount++;
          }
        }
        
        // Log extraction stats for debugging
        console.log(`Document scan results: ${stakeholders.length} found, ${successCount} created, ${skippedCount} skipped, ${failedCount} failed`);
        if (skippedReasons.length > 0) {
          console.log('Skipped reasons (first 5):', skippedReasons.slice(0, 5));
        }
        
        res.json({ 
          stakeholders: createdStakeholders,
          successCount,
          failedCount,
          skippedCount,
          totalFound: stakeholders.length,
          message: `Found ${stakeholders.length} entries, created ${successCount}, skipped ${skippedCount} (missing required fields), ${failedCount} failed`
        });
      } else {
        res.json({ stakeholders, totalFound: stakeholders.length });
      }
    } catch (error: any) {
      console.error('Document scan error:', error);
      // Provide more specific error messages based on the error type
      if (error?.code === 'context_length_exceeded' || error?.message?.includes('context') || error?.message?.includes('token')) {
        return res.status(400).json({ 
          error: "Document is too large to process. Please try splitting it into smaller files (max ~500 rows at a time) or removing unnecessary content." 
        });
      }
      if (error?.code === 'rate_limit_exceeded') {
        return res.status(429).json({ 
          error: "AI processing rate limit reached. Please wait a moment and try again." 
        });
      }
      if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
        return res.status(408).json({ 
          error: "Processing took too long. Please try with a smaller document." 
        });
      }
      res.status(500).json({ error: "Failed to scan document. Please try again or contact support if the issue persists." });
    }
  });

  // ===== INVESTORS TABLE ROUTES =====
  
  // Get all investors from investors table
  app.get("/api/investors-table", requireAuth, async (req, res) => {
    try {
      const investors = await storage.getAllInvestorsFromTable();
      res.json(investors);
    } catch (error) {
      console.error('Get investors table error:', error);
      res.status(500).json({ error: "Failed to fetch investors" });
    }
  });
  
  // Get single investor from investors table
  app.get("/api/investors-table/:id", requireAuth, async (req, res) => {
    try {
      const investor = await storage.getInvestorFromTable(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      res.json(investor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch investor" });
    }
  });
  
  // Create investor in investors table
  app.post("/api/investors-table", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const investor = await storage.createInvestorInTable({
        ...req.body,
        createdBy: user.id,
      });
      res.status(201).json(investor);
    } catch (error) {
      console.error('Create investor error:', error);
      res.status(500).json({ error: "Failed to create investor" });
    }
  });
  
  // Update investor in investors table
  app.patch("/api/investors-table/:id", requireAuth, async (req, res) => {
    try {
      const investor = await storage.getInvestorFromTable(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      const updated = await storage.updateInvestorInTable(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update investor" });
    }
  });
  
  // Delete investor from investors table
  app.delete("/api/investors-table/:id", requireAuth, async (req, res) => {
    try {
      const investor = await storage.getInvestorFromTable(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      await storage.deleteInvestorFromTable(req.params.id);
      res.json({ message: "Investor deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete investor" });
    }
  });

  // ===== ANNOUNCEMENT ROUTES =====
  
  // Get all announcements
  app.get("/api/announcements", requireAuth, async (req, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error('Get announcements error:', error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });
  
  // Get single announcement
  app.get("/api/announcements/:id", requireAuth, async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch announcement" });
    }
  });
  
  // Create announcement
  app.post("/api/announcements", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertAnnouncementSchema.safeParse({
        ...req.body,
        authorId: user.id,
        authorName: user.name,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const announcement = await storage.createAnnouncement(result.data);
      res.status(201).json(announcement);
    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });
  
  // Update announcement
  app.patch("/api/announcements/:id", requireAuth, async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      const updated = await storage.updateAnnouncement(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });
  
  // Delete announcement
  app.delete("/api/announcements/:id", requireAuth, async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      await storage.deleteAnnouncement(req.params.id);
      res.json({ message: "Announcement deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ===== POLL ROUTES =====
  
  // Get all polls
  app.get("/api/polls", requireAuth, async (req, res) => {
    try {
      const polls = await storage.getAllPolls();
      res.json(polls);
    } catch (error) {
      console.error('Get polls error:', error);
      res.status(500).json({ error: "Failed to fetch polls" });
    }
  });
  
  // Get single poll
  app.get("/api/polls/:id", requireAuth, async (req, res) => {
    try {
      const poll = await storage.getPoll(req.params.id);
      if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
      }
      res.json(poll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch poll" });
    }
  });
  
  // Create poll
  app.post("/api/polls", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertPollSchema.safeParse({
        ...req.body,
        creatorId: user.id,
        creatorName: user.name,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const poll = await storage.createPoll(result.data);
      res.status(201).json(poll);
    } catch (error) {
      console.error('Create poll error:', error);
      res.status(500).json({ error: "Failed to create poll" });
    }
  });
  
  // Update poll (for voting)
  app.patch("/api/polls/:id", requireAuth, async (req, res) => {
    try {
      const poll = await storage.getPoll(req.params.id);
      if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
      }
      const updated = await storage.updatePoll(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update poll" });
    }
  });
  
  // Delete poll
  app.delete("/api/polls/:id", requireAuth, async (req, res) => {
    try {
      const poll = await storage.getPoll(req.params.id);
      if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
      }
      await storage.deletePoll(req.params.id);
      res.json({ message: "Poll deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete poll" });
    }
  });

  // ===== MENTORSHIP PAIRING ROUTES =====
  
  // Get all mentorship pairings
  app.get("/api/mentorship-pairings", requireAuth, async (req, res) => {
    try {
      const pairings = await storage.getAllMentorshipPairings();
      res.json(pairings);
    } catch (error) {
      console.error('Get mentorship pairings error:', error);
      res.status(500).json({ error: "Failed to fetch mentorship pairings" });
    }
  });
  
  // Get single mentorship pairing
  app.get("/api/mentorship-pairings/:id", requireAuth, async (req, res) => {
    try {
      const pairing = await storage.getMentorshipPairing(req.params.id);
      if (!pairing) {
        return res.status(404).json({ error: "Mentorship pairing not found" });
      }
      res.json(pairing);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mentorship pairing" });
    }
  });
  
  // Create mentorship pairing (CEO only)
  app.post("/api/mentorship-pairings", generalLimiter, requireCEO, async (req, res) => {
    try {
      const result = insertMentorshipPairingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const pairing = await storage.createMentorshipPairing(result.data);
      
      const allUsers = await storage.getAllUsers();
      const mentor = allUsers.find(u => u.id === result.data.mentorId);
      const mentee = allUsers.find(u => u.id === result.data.menteeId);
      
      if (mentor && mentee) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7);
        startDate.setHours(10, 0, 0, 0);
        
        await storage.createMeeting({
          title: `Mentorship Session: ${mentor.name} & ${mentee.name}`,
          description: `Initial mentorship meeting between ${mentor.name} (mentor) and ${mentee.name} (mentee). Focus area: ${result.data.focusArea || 'General development'}`,
          scheduledFor: startDate,
          duration: 60,
          location: null,
          dealId: null,
          organizerId: (req.user as any)?.id || null,
          participants: [mentor.email, mentee.email],
          status: 'scheduled',
          videoPlatform: null,
          videoLink: null,
        });
        
        for (const user of [mentor, mentee]) {
          await storage.createNotification({
            userId: user.id,
            title: 'New Mentorship Pairing',
            message: user.id === mentor.id 
              ? `You have been paired with ${mentee.name} as their mentor. A kickoff meeting has been scheduled.`
              : `You have been paired with ${mentor.name} as your mentor. A kickoff meeting has been scheduled.`,
            type: 'info',
            link: '/ceo/mentorship',
          });
        }
      }
      
      res.status(201).json(pairing);
    } catch (error) {
      console.error('Create mentorship pairing error:', error);
      res.status(500).json({ error: "Failed to create mentorship pairing" });
    }
  });
  
  // Update mentorship pairing
  app.patch("/api/mentorship-pairings/:id", requireAuth, async (req, res) => {
    try {
      const pairing = await storage.getMentorshipPairing(req.params.id);
      if (!pairing) {
        return res.status(404).json({ error: "Mentorship pairing not found" });
      }
      const updated = await storage.updateMentorshipPairing(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update mentorship pairing" });
    }
  });
  
  // Delete mentorship pairing (CEO only)
  app.delete("/api/mentorship-pairings/:id", requireCEO, async (req, res) => {
    try {
      const pairing = await storage.getMentorshipPairing(req.params.id);
      if (!pairing) {
        return res.status(404).json({ error: "Mentorship pairing not found" });
      }
      await storage.deleteMentorshipPairing(req.params.id);
      res.json({ message: "Mentorship pairing deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete mentorship pairing" });
    }
  });

  // ===== CLIENT PORTAL ACCESS ROUTES =====
  
  // Get all client portal access entries
  app.get("/api/client-portal-access", requireAuth, async (req, res) => {
    try {
      const access = await storage.getAllClientPortalAccess();
      res.json(access);
    } catch (error) {
      console.error('Get client portal access error:', error);
      res.status(500).json({ error: "Failed to fetch client portal access" });
    }
  });
  
  // Get client portal access by deal
  app.get("/api/client-portal-access/deal/:dealId", requireAuth, async (req, res) => {
    try {
      const access = await storage.getClientPortalAccessByDeal(req.params.dealId);
      res.json(access);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client portal access for deal" });
    }
  });
  
  // Get single client portal access
  app.get("/api/client-portal-access/:id", requireAuth, async (req, res) => {
    try {
      const access = await storage.getClientPortalAccess(req.params.id);
      if (!access) {
        return res.status(404).json({ error: "Client portal access not found" });
      }
      res.json(access);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client portal access" });
    }
  });
  
  // Create client portal access
  app.post("/api/client-portal-access", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertClientPortalAccessSchema.safeParse({
        ...req.body,
        invitedBy: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const access = await storage.createClientPortalAccess(result.data);
      res.status(201).json(access);
    } catch (error) {
      console.error('Create client portal access error:', error);
      res.status(500).json({ error: "Failed to create client portal access" });
    }
  });
  
  // Update client portal access
  app.patch("/api/client-portal-access/:id", requireAuth, async (req, res) => {
    try {
      const access = await storage.getClientPortalAccess(req.params.id);
      if (!access) {
        return res.status(404).json({ error: "Client portal access not found" });
      }
      const updated = await storage.updateClientPortalAccess(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client portal access" });
    }
  });
  
  // Delete client portal access
  app.delete("/api/client-portal-access/:id", requireAuth, async (req, res) => {
    try {
      const access = await storage.getClientPortalAccess(req.params.id);
      if (!access) {
        return res.status(404).json({ error: "Client portal access not found" });
      }
      await storage.deleteClientPortalAccess(req.params.id);
      res.json({ message: "Client portal access deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client portal access" });
    }
  });

  // ===== DOCUMENT TEMPLATE ROUTES =====
  
  // Get all document templates
  app.get("/api/document-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getAllDocumentTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Get document templates error:', error);
      res.status(500).json({ error: "Failed to fetch document templates" });
    }
  });
  
  // Get single document template
  app.get("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document template" });
    }
  });
  
  // Create document template
  app.post("/api/document-templates", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertDocumentTemplateSchema.safeParse({
        ...req.body,
        createdBy: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const template = await storage.createDocumentTemplate(result.data);
      res.status(201).json(template);
    } catch (error) {
      console.error('Create document template error:', error);
      res.status(500).json({ error: "Failed to create document template" });
    }
  });
  
  // Update document template
  app.patch("/api/document-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      const updated = await storage.updateDocumentTemplate(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update document template" });
    }
  });
  
  // Delete document template (CEO only)
  app.delete("/api/document-templates/:id", requireCEO, async (req, res) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      await storage.deleteDocumentTemplate(req.params.id);
      res.json({ message: "Document template deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document template" });
    }
  });

  // ===== INVESTOR MATCH ROUTES =====
  
  // Get investor matches by deal
  app.get("/api/investor-matches/:dealId", requireAuth, async (req, res) => {
    try {
      const matches = await storage.getInvestorMatchesByDeal(req.params.dealId);
      res.json(matches);
    } catch (error) {
      console.error('Get investor matches error:', error);
      res.status(500).json({ error: "Failed to fetch investor matches" });
    }
  });
  
  // Create investor match
  app.post("/api/investor-matches", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertInvestorMatchSchema.safeParse({
        ...req.body,
        matchedBy: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const match = await storage.createInvestorMatch(result.data);
      
      await createAuditLog(req, 'investor_matched', 'investor_match', match.id?.toString(), `Investor ${req.body.investorId} - Deal ${req.body.dealId}`, {
        dealId: req.body.dealId,
        investorId: req.body.investorId,
        status: req.body.status
      });
      
      res.status(201).json(match);
    } catch (error) {
      console.error('Create investor match error:', error);
      res.status(500).json({ error: "Failed to create investor match" });
    }
  });
  
  // Delete investor match
  app.delete("/api/investor-matches/:dealId/:investorId", requireAuth, async (req, res) => {
    try {
      await storage.deleteInvestorMatch(req.params.dealId, parseInt(req.params.investorId));
      
      await createAuditLog(req, 'investor_match_removed', 'investor_match', undefined, `Investor ${req.params.investorId} - Deal ${req.params.dealId}`, {
        dealId: req.params.dealId,
        investorId: req.params.investorId
      });
      
      res.json({ message: "Investor match deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete investor match" });
    }
  });
  
  // Delete all investor matches for a deal
  app.delete("/api/investor-matches/:dealId", requireAuth, async (req, res) => {
    try {
      await storage.deleteInvestorMatchesByDeal(req.params.dealId);
      res.json({ message: "All investor matches deleted for deal" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete investor matches" });
    }
  });

  // ===== USER PREFERENCES ROUTES =====
  
  // Get user preferences
  app.get("/api/user-preferences", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const prefs = await storage.getUserPreferences(user.id);
      res.json(prefs || {
        userId: user.id,
        dashboardWidgets: [],
        sidebarCollapsed: false,
        theme: 'system',
        complianceDefaults: { sec: false, finra: false, legal: true },
        marketSymbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'SPY'],
      });
    } catch (error) {
      console.error('Get user preferences error:', error);
      res.status(500).json({ error: "Failed to fetch user preferences" });
    }
  });
  
  // Upsert user preferences
  app.post("/api/user-preferences", preferencesLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertUserPreferencesSchema.safeParse({
        ...req.body,
        userId: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const prefs = await storage.upsertUserPreferences(result.data);
      res.json(prefs);
    } catch (error) {
      console.error('Upsert user preferences error:', error);
      res.status(500).json({ error: "Failed to save user preferences" });
    }
  });
  
  // Update specific user preferences fields
  app.patch("/api/user-preferences", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      // First ensure preferences exist
      let prefs = await storage.getUserPreferences(user.id);
      if (!prefs) {
        prefs = await storage.upsertUserPreferences({
          userId: user.id,
          ...req.body,
        });
      } else {
        prefs = await storage.updateUserPreferencesRecord(user.id, req.body);
      }
      res.json(prefs);
    } catch (error) {
      console.error('Update user preferences error:', error);
      res.status(500).json({ error: "Failed to update user preferences" });
    }
  });

  // ===== DEAL TEMPLATE ROUTES =====
  
  // Get all deal templates
  app.get("/api/deal-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getAllDealTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Get deal templates error:', error);
      res.status(500).json({ error: "Failed to fetch deal templates" });
    }
  });
  
  // Get single deal template
  app.get("/api/deal-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getDealTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Deal template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deal template" });
    }
  });
  
  // Create deal template
  app.post("/api/deal-templates", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertDealTemplateSchema.safeParse({
        ...req.body,
        createdBy: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const template = await storage.createDealTemplate(result.data);
      res.status(201).json(template);
    } catch (error) {
      console.error('Create deal template error:', error);
      res.status(500).json({ error: "Failed to create deal template" });
    }
  });
  
  // Update deal template
  app.patch("/api/deal-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getDealTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Deal template not found" });
      }
      const updated = await storage.updateDealTemplate(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal template" });
    }
  });
  
  // Delete deal template (CEO only)
  app.delete("/api/deal-templates/:id", requireCEO, async (req, res) => {
    try {
      const template = await storage.getDealTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Deal template not found" });
      }
      await storage.deleteDealTemplate(req.params.id);
      res.json({ message: "Deal template deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal template" });
    }
  });

  // ===== GOOGLE CALENDAR INTEGRATION ROUTES (PER-USER OAUTH) =====
  
  // Check if Google Calendar integration is available and user's connection status
  app.get("/api/google-calendar/status", requireAuth, async (req, res) => {
    try {
      const { isGoogleOAuthConfigured, isUserConnected } = await import('./googleCalendar');
      const userId = (req.user as any).id;
      
      const configured = isGoogleOAuthConfigured();
      if (!configured) {
        return res.json({ configured: false, connected: false });
      }
      
      const connected = await isUserConnected(userId);
      res.json({ configured: true, connected });
    } catch (error) {
      res.json({ configured: false, connected: false });
    }
  });
  
  // Get OAuth URL to connect Google Calendar
  app.get("/api/google-calendar/connect", requireAuth, async (req, res) => {
    try {
      const { isGoogleOAuthConfigured, getAuthUrl } = await import('./googleCalendar');
      
      if (!isGoogleOAuthConfigured()) {
        return res.status(503).json({ error: "Google Calendar integration is not configured" });
      }
      
      const userId = (req.user as any).id;
      const { url } = getAuthUrl(userId);
      res.json({ authUrl: url });
    } catch (error: any) {
      console.error('Google Calendar connect error:', error);
      res.status(500).json({ error: "Failed to generate authorization URL" });
    }
  });
  
  // OAuth callback from Google
  app.get("/api/google-calendar/callback", async (req, res) => {
    // Helper to get redirect path based on user access level
    const getCalendarPath = (user: any) => {
      return user?.accessLevel === 'admin' ? '/ceo/calendar' : '/employee/calendar';
    };
    
    try {
      const { code, state, error: oauthError } = req.query;
      
      // Get the authenticated user from session first
      if (!req.isAuthenticated() || !req.user) {
        return res.redirect('/auth?error=not_authenticated');
      }
      
      const user = req.user as any;
      const calendarPath = getCalendarPath(user);
      
      if (oauthError) {
        console.error('OAuth error from Google:', oauthError);
        return res.redirect(`${calendarPath}?error=oauth_denied`);
      }
      
      if (!code || !state) {
        return res.redirect(`${calendarPath}?error=invalid_callback`);
      }
      
      const { validateOAuthState, handleOAuthCallback } = await import('./googleCalendar');
      const userId = user.id;
      
      // Validate that the state matches the authenticated user
      if (!validateOAuthState(state as string, userId)) {
        console.error('OAuth state validation failed');
        return res.redirect(`${calendarPath}?error=invalid_state`);
      }
      
      // Exchange code for tokens
      await handleOAuthCallback(code as string, userId);
      
      res.redirect(`${calendarPath}?connected=true`);
    } catch (error: any) {
      console.error('Google Calendar callback error:', error);
      const user = req.user as any;
      const calendarPath = getCalendarPath(user);
      res.redirect(`${calendarPath}?error=connection_failed`);
    }
  });
  
  // Disconnect Google Calendar
  app.post("/api/google-calendar/disconnect", requireAuth, async (req, res) => {
    try {
      const { disconnectUser } = await import('./googleCalendar');
      const userId = (req.user as any).id;
      
      await disconnectUser(userId);
      res.json({ message: "Google Calendar disconnected successfully" });
    } catch (error: any) {
      console.error('Google Calendar disconnect error:', error);
      res.status(500).json({ error: "Failed to disconnect Google Calendar" });
    }
  });
  
  // Fetch events from user's Google Calendar
  app.get("/api/google-calendar/events", requireAuth, async (req, res) => {
    try {
      const { listUserCalendarEvents, isUserConnected } = await import('./googleCalendar');
      const userId = (req.user as any).id;
      const { timeMin, timeMax, maxResults } = req.query;
      
      // Check if user is connected
      const connected = await isUserConnected(userId);
      if (!connected) {
        return res.status(401).json({ error: "Google Calendar not connected" });
      }
      
      const events = await listUserCalendarEvents(
        userId,
        maxResults ? parseInt(maxResults as string) : 50,
        timeMin ? new Date(timeMin as string) : undefined,
        timeMax ? new Date(timeMax as string) : undefined
      );
      
      // Transform Google Calendar events to a consistent format
      const transformedEvents = events.map((event: any) => ({
        id: event.id,
        googleEventId: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        location: event.location || '',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: !event.start?.dateTime,
        meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri,
        attendees: event.attendees?.map((a: any) => ({
          email: a.email,
          name: a.displayName,
          responseStatus: a.responseStatus
        })) || [],
        organizer: event.organizer?.email,
        status: event.status,
        htmlLink: event.htmlLink,
        source: 'google'
      }));
      
      res.json(transformedEvents);
    } catch (error: any) {
      console.error('Google Calendar fetch error:', error);
      if (error.message?.includes('not connected')) {
        return res.status(401).json({ error: "Google Calendar not connected" });
      }
      res.status(500).json({ error: "Failed to fetch Google Calendar events" });
    }
  });
  
  // Create event in user's Google Calendar
  app.post("/api/google-calendar/events", generalLimiter, requireAuth, async (req, res) => {
    try {
      const { createUserCalendarEvent } = await import('./googleCalendar');
      const userId = (req.user as any).id;
      const { title, description, location, start, end, attendees, addMeetLink } = req.body;
      
      if (!title || !start || !end) {
        return res.status(400).json({ error: "Title, start, and end are required" });
      }
      
      const event = await createUserCalendarEvent(userId, {
        summary: title,
        description,
        location,
        start: new Date(start),
        end: new Date(end),
        attendees,
        addMeetLink: addMeetLink !== false
      });
      
      res.status(201).json({
        id: event.id,
        googleEventId: event.id,
        title: event.summary,
        meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri,
        htmlLink: event.htmlLink,
        source: 'google'
      });
    } catch (error: any) {
      console.error('Google Calendar create error:', error);
      if (error.message?.includes('not connected')) {
        return res.status(401).json({ error: "Google Calendar not connected" });
      }
      res.status(500).json({ error: "Failed to create Google Calendar event" });
    }
  });
  
  // Delete event from user's Google Calendar
  app.delete("/api/google-calendar/events/:eventId", requireAuth, async (req, res) => {
    try {
      const { deleteUserCalendarEvent } = await import('./googleCalendar');
      const userId = (req.user as any).id;
      await deleteUserCalendarEvent(userId, req.params.eventId);
      res.json({ message: "Event deleted from Google Calendar" });
    } catch (error: any) {
      console.error('Google Calendar delete error:', error);
      res.status(500).json({ error: "Failed to delete Google Calendar event" });
    }
  });
  
  // Sync events from Google Calendar to platform (two-way sync)
  app.post("/api/google-calendar/sync", requireAuth, async (req, res) => {
    try {
      const { syncEventsFromGoogle, isUserConnected } = await import('./googleCalendar');
      const user = req.user as any;
      
      if (!await isUserConnected(user.id)) {
        return res.status(401).json({ error: "Google Calendar not connected" });
      }
      
      // Get events from Google Calendar
      const googleEvents = await syncEventsFromGoogle(user.id);
      
      // Get existing platform events to check for duplicates
      const platformEvents = await storage.getAllCalendarEvents();
      const existingGoogleIds = new Set(platformEvents.filter(e => e.googleCalendarEventId).map(e => e.googleCalendarEventId));
      const existingPlatformEventIds = new Set(platformEvents.map(e => e.id));
      
      let imported = 0;
      let skipped = 0;
      
      for (const gEvent of googleEvents) {
        if (!gEvent.id || !gEvent.summary) continue;
        
        // Skip if already synced (has this Google Calendar event ID)
        if (existingGoogleIds.has(gEvent.id)) {
          skipped++;
          continue;
        }
        
        // Check if this is a platform event by extended properties
        const platformEventId = gEvent.extendedProperties?.private?.kronosPlatformEventId;
        if (platformEventId && existingPlatformEventIds.has(platformEventId)) {
          skipped++;
          continue;
        }
        
        // Extract date/time from Google event
        let eventDate: string;
        let eventTime: string | undefined;
        let isAllDay = false;
        
        if (gEvent.start?.date) {
          // All-day event
          eventDate = gEvent.start.date;
          isAllDay = true;
        } else if (gEvent.start?.dateTime) {
          const startDt = new Date(gEvent.start.dateTime);
          eventDate = startDt.toISOString().split('T')[0];
          eventTime = startDt.toTimeString().slice(0, 5);
        } else {
          continue; // Skip if no valid start time
        }
        
        // Create platform event from Google event
        await storage.createCalendarEvent({
          title: gEvent.summary,
          description: gEvent.description || undefined,
          location: gEvent.location || undefined,
          date: eventDate,
          time: eventTime,
          isAllDay,
          type: 'meeting',
          status: 'scheduled',
          createdBy: user.id,
          googleCalendarEventId: gEvent.id,
          syncSource: 'google',
          participants: gEvent.attendees?.map(a => a.email || '').filter(Boolean) || [],
        });
        
        imported++;
      }
      
      res.json({
        message: `Sync completed: ${imported} events imported, ${skipped} already synced`,
        imported,
        skipped,
        totalGoogleEvents: googleEvents.length
      });
    } catch (error: any) {
      console.error('Google Calendar sync error:', error);
      if (error.message?.includes('not connected')) {
        return res.status(401).json({ error: "Google Calendar not connected" });
      }
      res.status(500).json({ error: "Failed to sync from Google Calendar" });
    }
  });

  // ===== CALENDAR EVENT ROUTES =====
  
  // Get all calendar events (filtered to user's own events)
  app.get("/api/calendar-events", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const userEmail = (user.email || '').toLowerCase().trim();
      const allEvents = await storage.getAllCalendarEvents();
      
      // Filter to only show events created by the current user or where they are a participant
      const userEvents = allEvents.filter(event => {
        // Check if user created this event (must be valid createdBy)
        if (event.createdBy && event.createdBy === user.id) return true;
        
        // Check if user is in participants list (handle both string arrays and object arrays)
        if (event.participants && Array.isArray(event.participants) && userEmail) {
          return event.participants.some((p: any) => {
            // Handle string entries
            if (typeof p === 'string' && p.trim()) {
              return p.toLowerCase().trim() === userEmail;
            }
            // Handle object entries with email property
            if (p && typeof p === 'object' && typeof p.email === 'string' && p.email.trim()) {
              return p.email.toLowerCase().trim() === userEmail;
            }
            // Skip invalid entries
            return false;
          });
        }
        
        // Don't include events without createdBy and without matching participant
        return false;
      });
      res.json(userEvents);
    } catch (error) {
      console.error('Get calendar events error:', error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });
  
  // Get calendar events by deal
  app.get("/api/calendar-events/deal/:dealId", requireAuth, async (req, res) => {
    try {
      const events = await storage.getCalendarEventsByDeal(req.params.dealId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });
  
  // Get single calendar event
  app.get("/api/calendar-events/:id", requireAuth, async (req, res) => {
    try {
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Calendar event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calendar event" });
    }
  });
  
  // Create calendar event
  app.post("/api/calendar-events", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertCalendarEventSchema.safeParse({
        ...req.body,
        createdBy: user.id,
        syncSource: 'platform',
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const event = await storage.createCalendarEvent(result.data);
      
      // Sync to Google Calendar if user is connected
      try {
        const { isUserConnected, syncEventToGoogle } = await import('./googleCalendar');
        if (await isUserConnected(user.id)) {
          const syncResult = await syncEventToGoogle(user.id, event);
          // Update the event with Google Calendar ID
          await storage.updateCalendarEvent(event.id, {
            googleCalendarEventId: syncResult.googleEventId,
            googleCalendarSyncedAt: new Date(),
          } as any);
          event.googleCalendarEventId = syncResult.googleEventId;
        }
      } catch (syncError) {
        console.log('Google Calendar sync skipped:', (syncError as Error).message);
      }
      
      await createAuditLog(req, 'calendar_event_created', 'calendar_event', event.id, event.title, {
        date: event.date,
        investor: event.investor,
        dealId: event.dealId,
        status: event.status
      });
      
      res.status(201).json(event);
    } catch (error) {
      console.error('Create calendar event error:', error);
      res.status(500).json({ error: "Failed to create calendar event" });
    }
  });
  
  // Update calendar event
  app.patch("/api/calendar-events/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Calendar event not found" });
      }
      const updated = await storage.updateCalendarEvent(req.params.id, req.body);
      
      // Sync to Google Calendar if user is connected
      if (updated) {
        try {
          const { isUserConnected, syncEventToGoogle } = await import('./googleCalendar');
          if (await isUserConnected(user.id)) {
            const syncResult = await syncEventToGoogle(user.id, updated);
            // Update sync timestamp
            await storage.updateCalendarEvent(updated.id, {
              googleCalendarEventId: syncResult.googleEventId,
              googleCalendarSyncedAt: new Date(),
            } as any);
          }
        } catch (syncError) {
          console.log('Google Calendar sync skipped:', (syncError as Error).message);
        }
      }
      
      await createAuditLog(req, 'calendar_event_updated', 'calendar_event', updated?.id || req.params.id, updated?.title || event.title, req.body);
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update calendar event" });
    }
  });
  
  // Delete calendar event
  app.delete("/api/calendar-events/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Calendar event not found" });
      }
      
      // Delete from Google Calendar if synced
      if (event.googleCalendarEventId) {
        try {
          const { isUserConnected, deleteUserCalendarEvent } = await import('./googleCalendar');
          if (await isUserConnected(user.id)) {
            await deleteUserCalendarEvent(user.id, event.googleCalendarEventId);
          }
        } catch (syncError) {
          console.log('Google Calendar delete skipped:', (syncError as Error).message);
        }
      }
      
      await storage.deleteCalendarEvent(req.params.id);
      
      await createAuditLog(req, 'calendar_event_deleted', 'calendar_event', req.params.id, event.title, {
        date: event.date,
        investor: event.investor,
        dealId: event.dealId
      });
      
      res.json({ message: "Calendar event deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // ===== TASK ATTACHMENT ROUTES =====
  
  // Get task attachments
  app.get("/api/task-attachments/:taskId", requireAuth, async (req, res) => {
    try {
      const attachments = await storage.getTaskAttachmentRecords(req.params.taskId);
      res.json(attachments);
    } catch (error) {
      console.error('Get task attachments error:', error);
      res.status(500).json({ error: "Failed to fetch task attachments" });
    }
  });
  
  // Create task attachment record (metadata only - file upload would need separate handling)
  app.post("/api/task-attachments", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const result = insertTaskAttachmentRecordSchema.safeParse({
        ...req.body,
        uploadedBy: user.id,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromError(result.error).toString() });
      }
      const attachment = await storage.createTaskAttachmentRecord(result.data);
      res.status(201).json(attachment);
    } catch (error) {
      console.error('Create task attachment error:', error);
      res.status(500).json({ error: "Failed to create task attachment" });
    }
  });
  
  // Delete task attachment record
  app.delete("/api/task-attachments/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTaskAttachmentRecord(req.params.id);
      res.json({ message: "Task attachment deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task attachment" });
    }
  });
  
  // ===== DOCUMENT STORAGE ROUTES =====
  
  // Get all documents
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });
  
  // Get documents by deal
  app.get("/api/documents/deal/:dealId", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocumentsByDeal(req.params.dealId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });
  
  // Get single document
  app.get("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });
  
  // Create document (metadata - file storage handled separately)
  app.post("/api/documents", generalLimiter, requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const doc = await storage.createDocument({
        ...req.body,
        uploadedBy: user.id,
      });
      await createAuditLog(req, 'document_created', 'document', doc.id, doc.title, { category: doc.category, dealId: doc.dealId });
      res.status(201).json(doc);
    } catch (error) {
      console.error('Create document error:', error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });
  
  // Update document
  app.patch("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      const updated = await storage.updateDocument(req.params.id, req.body);
      await createAuditLog(req, 'document_updated', 'document', req.params.id, doc.title, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update document" });
    }
  });
  
  // Archive/delete document (soft delete)
  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      await storage.deleteDocument(req.params.id);
      await createAuditLog(req, 'document_archived', 'document', req.params.id, doc.title);
      res.json({ message: "Document archived" });
    } catch (error) {
      res.status(500).json({ error: "Failed to archive document" });
    }
  });
  
  // ===== DATABASE INVESTORS ROUTES =====
  
  // Get all investors from database
  app.get("/api/db-investors", requireAuth, async (req, res) => {
    try {
      const investors = await storage.getAllInvestorsFromTable();
      res.json(investors);
    } catch (error) {
      console.error('Get investors error:', error);
      res.status(500).json({ error: "Failed to fetch investors" });
    }
  });
  
  // Get single investor
  app.get("/api/db-investors/:id", requireAuth, async (req, res) => {
    try {
      const investor = await storage.getInvestorFromTable(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      res.json(investor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch investor" });
    }
  });
  
  // Create investor (CEO only)
  app.post("/api/db-investors", generalLimiter, requireCEO, async (req, res) => {
    try {
      const investor = await storage.createInvestorInTable(req.body);
      await createAuditLog(req, 'investor_created', 'investor', investor.id, investor.name, { firm: investor.firm, type: investor.type });
      res.status(201).json(investor);
    } catch (error) {
      console.error('Create investor error:', error);
      res.status(500).json({ error: "Failed to create investor" });
    }
  });
  
  // Update investor
  app.patch("/api/db-investors/:id", requireAuth, async (req, res) => {
    try {
      const investor = await storage.getInvestorFromTable(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      const updated = await storage.updateInvestorInTable(req.params.id, req.body);
      await createAuditLog(req, 'investor_updated', 'investor', req.params.id, investor.name, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update investor" });
    }
  });
  
  // Delete investor (soft delete - deactivate)
  app.delete("/api/db-investors/:id", requireCEO, async (req, res) => {
    try {
      const investor = await storage.getInvestorFromTable(req.params.id);
      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }
      await storage.deleteInvestorFromTable(req.params.id);
      await createAuditLog(req, 'investor_deactivated', 'investor', req.params.id, investor.name);
      res.json({ message: "Investor deactivated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate investor" });
    }
  });
  
  // ===== CLIENT PORTAL EXTERNAL USER ROUTES =====
  
  // Get all portal invites (CEO only)
  app.get("/api/portal/invites", requireCEO, async (req, res) => {
    try {
      const invites = await storage.getAllClientPortalInvites();
      res.json(invites);
    } catch (error) {
      console.error('Get portal invites error:', error);
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });
  
  // Create portal invite (CEO only) - sends email invitation
  app.post("/api/portal/invites", generalLimiter, requireCEO, async (req, res) => {
    try {
      const { email, name, organization, dealIds, accessLevel, message } = req.body;
      const user = req.user as any;
      
      if (!email || !name || !dealIds || dealIds.length === 0) {
        return res.status(400).json({ error: "Email, name, and at least one deal are required" });
      }
      
      // Check if email already has a pending invite
      const existingInvites = await storage.getAllClientPortalInvites();
      const pendingInvite = existingInvites.find(i => i.email === email && i.status === 'pending');
      if (pendingInvite) {
        return res.status(400).json({ error: "This email already has a pending invitation" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const invite = await storage.createClientPortalInvite({
        email,
        name,
        organization: organization || null,
        token,
        dealIds,
        accessLevel: accessLevel || 'view',
        invitedBy: user.id,
        inviterName: user.name,
        message: message || null,
        status: 'pending',
        expiresAt,
      });
      
      // Send invitation email via Resend
      try {
        const { sendPortalInviteEmail } = await import('./email');
        await sendPortalInviteEmail({
          to: email,
          recipientName: name,
          inviterName: user.name,
          organization: organization || undefined,
          message: message || undefined,
          token,
          expiresAt,
        });
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Continue - invite is created, just email failed
      }
      
      await createAuditLog(req, 'portal_invite_created', 'portal_invite', invite.id, email, { organization, dealIds, accessLevel });
      res.status(201).json(invite);
    } catch (error) {
      console.error('Create portal invite error:', error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });
  
  // Revoke portal invite (CEO only)
  app.post("/api/portal/invites/:id/revoke", requireCEO, async (req, res) => {
    try {
      const invite = await storage.getClientPortalInvite(req.params.id);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      
      const updated = await storage.updateClientPortalInvite(req.params.id, { status: 'revoked' });
      await createAuditLog(req, 'portal_invite_revoked', 'portal_invite', req.params.id, invite.email);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  });
  
  // Get invite by token (public - for registration)
  app.get("/api/portal/register/:token", async (req, res) => {
    try {
      const invite = await storage.getClientPortalInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      
      // Get deal names for display
      const dealNames: string[] = [];
      const dealIds = invite.dealIds as string[] || [];
      for (const dealId of dealIds) {
        const deal = await storage.getDeal(dealId);
        if (deal) dealNames.push(deal.name);
      }
      
      res.json({
        email: invite.email,
        name: invite.name,
        organization: invite.organization,
        inviterName: invite.inviterName,
        accessLevel: invite.accessLevel,
        dealNames,
        expiresAt: invite.expiresAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });
  
  // Complete registration from invite (public)
  app.post("/api/portal/register/:token", authLimiter, async (req, res) => {
    try {
      const { password, phone } = req.body;
      
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      const invite = await storage.getClientPortalInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      
      // Create external user
      const user = await storage.createExternalUser({
        name: invite.name,
        email: invite.email,
        password,
        phone: phone || null,
        isExternal: true,
        externalOrganization: invite.organization || undefined,
        invitedBy: invite.invitedBy,
        role: 'External',
        status: 'active',
      });
      
      // Mark invite as accepted
      await storage.updateClientPortalInvite(invite.id, {
        status: 'accepted',
        acceptedAt: new Date(),
        userId: user.id,
      });
      
      // Log user in
      req.login(user, (err) => {
        if (err) {
          console.error('Auto-login error:', err);
          return res.status(201).json({ success: true, message: "Account created. Please log in." });
        }
        
        res.status(201).json({
          success: true,
          user: sanitizeUser(user),
        });
      });
      
      // Audit log
      await createAuditLog(req, 'external_user_registered', 'user', user.id, invite.name, { 
        organization: invite.organization,
        invitedBy: invite.invitedBy 
      });
    } catch (error) {
      console.error('Portal registration error:', error);
      res.status(500).json({ error: "Failed to complete registration" });
    }
  });
  
  // External user login (separate endpoint for external portal)
  app.post("/api/portal/login", authLimiter, (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      
      // Verify this is an external user
      if (!user.isExternal) {
        return res.status(403).json({ error: "Please use the main login for internal users" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });
  
  // Get external user's accessible deals
  app.get("/api/portal/my-deals", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.isExternal) {
        return res.status(403).json({ error: "This endpoint is for external users only" });
      }
      
      const deals = await storage.getExternalUserDeals(user.id);
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });
  
  // Get portal updates for a deal (external users)
  app.get("/api/portal/deals/:dealId/updates", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      // If external user, verify they have access to this deal
      if (user.isExternal) {
        const userDeals = await storage.getExternalUserDeals(user.id);
        if (!userDeals.some(d => d.id === req.params.dealId)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const updates = await storage.getClientPortalUpdatesByDeal(req.params.dealId);
      // For external users, only show public updates
      const visibleUpdates = user.isExternal 
        ? updates.filter(u => u.isPublic)
        : updates;
      
      res.json(visibleUpdates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch updates" });
    }
  });
  
  // Create portal update (internal users only)
  app.post("/api/portal/deals/:dealId/updates", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.isExternal) {
        return res.status(403).json({ error: "External users cannot create updates" });
      }
      
      const { title, content, type, isPublic } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }
      
      const update = await storage.createClientPortalUpdate({
        dealId: req.params.dealId,
        title,
        content,
        type: type || 'update',
        authorId: user.id,
        authorName: user.name,
        isPublic: isPublic !== false,
      });
      
      res.status(201).json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to create update" });
    }
  });
  
  // Get portal messages for a deal
  app.get("/api/portal/deals/:dealId/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      // If external user, verify they have access to this deal
      if (user.isExternal) {
        const userDeals = await storage.getExternalUserDeals(user.id);
        if (!userDeals.some(d => d.id === req.params.dealId)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const messages = await storage.getClientPortalMessagesByDeal(req.params.dealId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  // Send portal message
  app.post("/api/portal/deals/:dealId/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      // If external user, verify they have access to this deal
      if (user.isExternal) {
        const userDeals = await storage.getExternalUserDeals(user.id);
        if (!userDeals.some(d => d.id === req.params.dealId)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      const message = await storage.createClientPortalMessage({
        dealId: req.params.dealId,
        senderId: user.id,
        senderName: user.name,
        isExternal: user.isExternal || false,
        content,
      });
      
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Get all external users (CEO only)
  app.get("/api/portal/users", requireCEO, async (req, res) => {
    try {
      const users = await storage.getExternalUsers();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch external users" });
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
