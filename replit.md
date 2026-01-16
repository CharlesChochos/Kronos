# Overview

Kronos is a full-stack investment banking operations platform designed to streamline deal management, task assignments, document handling, investor matching, and team collaboration. It provides role-based interfaces for CEOs and employees, aiming to enhance operational efficiency and strategic decision-making within investment banking firms. The platform is built with a React/Vite frontend and an Express backend, leveraging a PostgreSQL database (Neon) and session-based authentication.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is built with React 18, TypeScript, and Vite. It utilizes `shadcn/ui` with the "new-york" style variant for a consistent design system. Styling is managed with Tailwind CSS, featuring a custom fintech-focused navy blue color scheme and dark mode support. The font stack includes Inter, Plus Jakarta Sans, and Space Mono. Role-based layouts ensure tailored experiences for CEOs and employees, with protected routes and reusable UI components.

### Mobile Optimization (January 2026)
Platform-wide mobile responsiveness has been implemented across all major pages:
- **Responsive Grids:** All stat card grids use `grid-cols-2 sm:grid-cols-4` or similar patterns for proper mobile stacking
- **Responsive Typography:** Font sizes scale appropriately (e.g., `text-xl sm:text-2xl`, `text-[10px] sm:text-xs`)
- **Responsive Spacing:** Padding and gaps adjust for mobile (e.g., `p-3 sm:p-4`, `gap-2 sm:gap-4`)
- **Responsive Icons:** Icon sizes scale with breakpoints (e.g., `w-4 h-4 sm:w-5 sm:h-5`)
- **Sheet/Dialog Widths:** Side panels use `w-full sm:w-[Npx]` to prevent horizontal overflow on mobile
- **Shortened Labels:** Mobile-friendly abbreviated labels where space is constrained

## Technical Implementations

### Frontend
- **State Management:** TanStack Query (React Query) v5 for server state and caching.
- **Routing:** `wouter` for client-side routing.
- **Form Handling:** `react-hook-form` with Zod for validation.
- **Notifications:** `sonner` for toast notifications.
- **Icons:** `lucide-react`.

### Backend
- **Server:** Express.js with TypeScript and Node.js.
- **Authentication:** Passport.js with LocalStrategy for email/password, `express-session` for session management, and `bcryptjs` for password hashing. Two-factor authentication (TOTP-based) is implemented using `otplib` and `qrcode`.
- **API:** RESTful API endpoints with request logging and JSON body parsing.
- **Database ORM:** Drizzle ORM for type-safe PostgreSQL queries.
- **Type Safety:** Zod schemas and shared TypeScript types between frontend and backend.
- **Object Storage:** Integration with Replit Object Storage for large file uploads (up to 500MB) using presigned URLs and owner-scoped access control.
- **AI Assistant:** An integrated AI assistant powered by OpenAI (gpt-5 model via Replit AI Integrations) provides role-appropriate context from platform data (deals, tasks, users, documents). It supports persistent conversation history and automatic title generation.
- **Audit Logging:** A system-wide audit trail logs authentication, user management, deal, task, and document operations, accessible to CEOs with filtering and export capabilities.

## System Design Choices

- **Data Persistence:** PostgreSQL database managed via Neon serverless driver.
- **Schema Design:** Comprehensive schema includes tables for Users (with roles, job titles, performance metrics, 2FA fields), Deals (stage, value, client, sector, archive fields), Tasks (assignments, priority, due dates), Meetings, Notifications, Investor Matches, User Preferences (for UI state), Deal Templates, Calendar Events, Task Attachments, Documents (with file data, categories, tags), Messages, Conversations, and Conversation Members. A dedicated `audit_logs_table` tracks system events. Task Templates feature includes `taskTemplates`, `taskTemplateSections`, `taskTemplateTasks`, and `taskTemplateUsageLog` tables.
- **HR Task Templates:** Asana-inspired task templates system allowing HR administrators (Dimitra and Charles only) to create reusable templates with sections, tasks, assignees, and relative due dates. Templates can be applied to create real tasks with computed due dates based on a start date.
- **Deal Archiving:** Soft-delete system for deals using `archivedAt`, `archivedReason`, `archivedNotes`, and `archivedBy` fields. Archived deals preserve all documents and related data for future reference. Users can browse archived deals in a dedicated page and restore them to active status. Archive filtering is applied server-side in deal listings.
- **User Preferences Persistence:** UI state is saved to the `user_preferences` table, with debounced saves and conflict resolution for concurrent updates.
- **Security:** Invite-only registration, user suspension, and robust role-based access control.

# External Dependencies

- **Database:** Neon (PostgreSQL serverless driver)
- **ORM:** `drizzle-orm`, `drizzle-kit`
- **Authentication:** `passport`, `passport-local`, `bcryptjs`, `express-session`, `otplib`, `qrcode`
- **Frontend Libraries:** `@tanstack/react-query`, `wouter`, `@radix-ui/*`, `tailwindcss`, `react-hook-form`, `zod`, `sonner`, `lucide-react`
- **Build Tools:** `vite`, `@vitejs/plugin-react`, `esbuild`, `tsx`
- **Utilities:** `clsx`, `tailwind-merge`, `class-variance-authority`, `date-fns`, `nanoid`
- **Email Service:** Resend (via Replit Connectors)
- **AI Integration:** OpenAI (via Replit AI Integrations)
- **Object Storage:** Replit Object Storage