import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { fromError } from "zod-validation-error";

const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>]/g, '')
    .trim();
};

const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const emailSchema = z.string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .max(255, "Email too long")
  .transform(sanitizeEmail);

export const passwordSchema = z.string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password too long");

export const nameSchema = z.string()
  .min(1, "Name is required")
  .max(100, "Name too long")
  .transform(sanitizeString);

export const idSchema = z.string()
  .min(1, "ID is required")
  .max(100, "ID too long")
  .regex(/^[a-zA-Z0-9-_]+$/, "Invalid ID format");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.enum(['CEO', 'Managing Director', 'Director', 'Associate', 'Analyst']).optional(),
  phone: z.string().max(20).optional().transform(val => val ? sanitizeString(val) : val),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required").max(128),
  newPassword: passwordSchema,
});

export const dealSchema = z.object({
  name: z.string().min(1, "Deal name is required").max(200).transform(sanitizeString),
  stage: z.enum(['Origination', 'Qualification', 'Due Diligence', 'Negotiation', 'Closing', 'Closed Won', 'Closed Lost']).optional(),
  value: z.number().min(0).max(1000000),
  client: z.string().min(1, "Client is required").max(200).transform(sanitizeString),
  sector: z.string().min(1, "Sector is required").max(100).transform(sanitizeString),
  lead: z.string().min(1, "Lead is required").max(100).transform(sanitizeString),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(['Active', 'On Hold', 'Completed', 'Cancelled']).optional(),
  description: z.string().max(5000).optional().transform(val => val ? sanitizeString(val) : val),
  podTeam: z.array(z.object({
    userId: z.string().optional(),
    name: z.string().max(100),
    role: z.string().max(50),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    slack: z.string().max(50).optional(),
  })).optional(),
  taggedInvestors: z.array(z.object({
    id: z.string(),
    name: z.string().max(100),
    firm: z.string().max(200),
    type: z.string().max(50),
    status: z.string().max(50),
    notes: z.string().max(1000).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    website: z.string().url().optional(),
  })).optional(),
}).partial().refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).transform(sanitizeString),
  description: z.string().max(5000).optional().transform(val => val ? sanitizeString(val) : val),
  dealId: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedBy: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (use YYYY-MM-DD)"),
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled']).optional(),
  type: z.string().min(1, "Type is required").max(50),
});

export const meetingSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).transform(sanitizeString),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (use HH:MM)"),
  attendees: z.array(z.string().max(100)).min(1, "At least one attendee required"),
  location: z.string().max(200).optional().transform(val => val ? sanitizeString(val) : val),
  dealId: z.string().optional(),
  description: z.string().max(5000).optional().transform(val => val ? sanitizeString(val) : val),
  timezone: z.string().max(50).optional(),
  externalAttendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().max(100),
  })).optional(),
});

export const notificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['info', 'success', 'warning', 'alert']),
  title: z.string().min(1).max(200).transform(sanitizeString),
  message: z.string().min(1).max(1000).transform(sanitizeString),
  link: z.string().max(500).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().max(200).optional().transform(val => val ? sanitizeString(val) : val),
  filter: z.string().max(100).optional(),
});

export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: fromError(result.error).toString(),
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ 
        error: fromError(result.error).toString(),
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({ 
        error: fromError(result.error).toString(),
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.params = result.data;
    next();
  };
}

export const idParamSchema = z.object({
  id: idSchema,
});
