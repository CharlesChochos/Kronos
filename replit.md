# Overview

OSReaper (formerly Equiturn OS) is a full-stack investment banking operations platform built with a React/Vite frontend and Express backend. The application provides role-based interfaces for CEOs and employees to manage deals, tasks, documents, investor matching, and team assignments. It uses a PostgreSQL database via Neon for data persistence and implements session-based authentication with Passport.js.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build Tool**
- React 18 with TypeScript running on Vite for development and production builds
- Client-side routing implemented with Wouter (lightweight alternative to React Router)
- Component library based on shadcn/ui (Radix UI primitives with Tailwind CSS styling)
- Uses the "new-york" style variant for shadcn components

**State Management**
- TanStack Query (React Query) v5 for server state management and API caching
- Query client configured with infinite stale time and disabled refetching on window focus
- No global client state management library - relies on server state and local component state

**Styling & Design System**
- Tailwind CSS with custom theme configuration
- Custom fintech-focused navy blue color scheme defined in `index.css`
- Uses CSS custom properties for theming with dark mode support
- Font stack: Inter, Plus Jakarta Sans, and Space Mono

**Component Architecture**
- Role-based layouts with separate CEO and Employee views
- Protected routes using custom `ProtectedRoute` wrapper component
- Shared `Layout` component with sidebar navigation and header
- Reusable UI components from shadcn/ui library in `/components/ui`

## Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- HTTP server wrapped with native Node.js `http.createServer`
- Development mode uses Vite middleware for hot module replacement
- Production build bundles server code with esbuild

**Authentication & Session Management**
- Passport.js with LocalStrategy for email/password authentication
- Session management using express-session with in-memory store (default)
- Bcrypt for password hashing (10 salt rounds)
- Session cookies configured for 1 week expiration
- Session secret from environment variable with fallback default

**API Architecture**
- RESTful API endpoints under `/api` prefix
- Request logging middleware that captures method, path, status, and duration
- JSON body parsing with raw body preservation for webhook validation
- Protected endpoints check for authenticated user session

**Database Layer**
- Drizzle ORM for type-safe database queries
- Repository pattern implemented via `IStorage` interface and `DatabaseStorage` class
- Database operations abstracted into methods for users, deals, and tasks
- Schema definitions in shared folder for type sharing between client/server

## Data Storage

**Database**
- PostgreSQL via Neon serverless driver
- Connection via `DATABASE_URL` environment variable
- Drizzle Kit for schema migrations (output to `/migrations` folder)

**Schema Design**
- **Users table**: Authentication, roles (CEO/Associate/Director/Managing Director/Analyst), performance metrics (score, active deals, completed tasks)
- **Deals table**: Deal information including stage, value, client, sector, lead, progress percentage, status, and description
- **Tasks table**: Task assignments with references to users and deals, priority levels, due dates, and status tracking
- **Meetings table**: Meeting scheduling with title, date/time, attendees, location, deal association, and description
- **Notifications table**: User notifications with type (info/success/warning/alert), title, message, read status, and link reference

**Type Safety**
- Zod schemas generated from Drizzle table definitions
- Shared TypeScript types between frontend and backend
- Insert schemas omit auto-generated fields (id, createdAt)

## External Dependencies

**Database & ORM**
- `@neondatabase/serverless` - Neon PostgreSQL serverless driver
- `drizzle-orm` - TypeScript ORM for database operations
- `drizzle-kit` - CLI tool for schema migrations

**Authentication**
- `passport` - Authentication middleware
- `passport-local` - Username/password authentication strategy
- `bcryptjs` - Password hashing
- `express-session` - Session management middleware

**Frontend Libraries**
- `@tanstack/react-query` - Server state management
- `wouter` - Lightweight routing
- `@radix-ui/*` - Headless UI component primitives
- `tailwindcss` - Utility-first CSS framework
- `@tailwindcss/vite` - Vite plugin for Tailwind
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `zod` - Schema validation
- `sonner` - Toast notifications
- `lucide-react` - Icon library

**Build & Development Tools**
- `vite` - Build tool and dev server
- `@vitejs/plugin-react` - React plugin for Vite
- `esbuild` - JavaScript bundler for server production build
- `tsx` - TypeScript execution for development
- `@replit/vite-plugin-*` - Replit-specific development plugins

**Utility Libraries**
- `clsx` + `tailwind-merge` - Conditional className utilities
- `class-variance-authority` - Component variant management
- `date-fns` - Date formatting and manipulation
- `nanoid` - Unique ID generation

**Notes on Architecture**
- The application is designed to run on Replit with environment-specific plugins for development
- Custom Vite plugin (`vite-plugin-meta-images`) updates OpenGraph meta tags with deployment URLs
- Session storage is in-memory by default but includes `connect-pg-simple` for PostgreSQL session store option
- The build process separates client (Vite) and server (esbuild) builds with selective dependency bundling for server cold-start optimization

## Email Integration

**Resend Email Service**
- Uses Replit Connectors for secure API key management (no hardcoded secrets)
- Meeting invites are sent automatically when scheduling meetings with external participants
- Email service preserves organizer's local timezone for accurate meeting time display
- Beautifully formatted HTML emails with OSReaper branding
- Graceful error handling - meeting creation succeeds even if email fails