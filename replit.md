# Overview

Kronos is a full-stack investment banking operations platform designed to streamline deal management, task assignments, document handling, investor matching, and team collaboration. It provides role-based interfaces for CEOs and employees, aiming to enhance operational efficiency and strategic decision-making within investment banking firms. The platform is built with a React/Vite frontend and an Express backend, leveraging a PostgreSQL database (Neon) and session-based authentication.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The frontend is built with React 18, TypeScript, and Vite. It utilizes `shadcn/ui` with the "new-york" style variant for a consistent design system. Styling is managed with Tailwind CSS, featuring a custom fintech-focused navy blue color scheme and dark mode support. The font stack includes Inter, Plus Jakarta Sans, and Space Mono. Role-based layouts ensure tailored experiences for CEOs and employees, with protected routes and reusable UI components.

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
- **Schema Design:** Comprehensive schema includes tables for Users (with roles, job titles, performance metrics, 2FA fields), Deals (stage, value, client, sector), Tasks (assignments, priority, due dates), Meetings, Notifications, Investor Matches, User Preferences (for UI state), Deal Templates, Calendar Events, Task Attachments, Documents (with file data, categories, tags), Messages, Conversations, and Conversation Members. A dedicated `audit_logs_table` tracks system events.
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