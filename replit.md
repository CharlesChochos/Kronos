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
- **Users table**: Authentication, roles (CEO/Associate/Director/Managing Director/Analyst), jobTitle (Junior Analyst/Analyst/Associate/Senior Associate/VP/Other), performance metrics (score, active deals, completed tasks), status (active/pending/suspended), 2FA fields (twoFactorEnabled, twoFactorSecret)
- **Deals table**: Deal information including stage, value, client, sector, lead, progress percentage, status, and description
- **Tasks table**: Task assignments with references to users and deals, priority levels, due dates, and status tracking
- **Meetings table**: Meeting scheduling with title, date/time, attendees, location, deal association, and description
- **Notifications table**: User notifications with type (info/success/warning/alert), title, message, read status, and link reference
- **investor_matches table**: Stores investor match/reject decisions per user with status (matched/rejected/pending)
- **user_preferences table**: Dashboard widgets, sidebar collapsed state, theme, market symbols, compliance defaults, and settings (employeeHome, flaggedTasks, sidebarCategories, unreadMessageCount)
- **deal_templates table**: Document templates with category, description, sections, and sector-specific tags
- **calendar_events table**: Capital raising events with investor, deal, status, location, and notes
- **task_attachments table**: File metadata for task attachments (filename, URL, size, type)
- **documents table**: Document storage with file data (base64), filename, category, deal association, tags, uploadedBy, isArchived

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

**User Preferences Persistence Pattern**
- All user-specific UI state is persisted to the `user_preferences` table (no localStorage)
- Components use `useUserPreferences` hook to load and `useSaveUserPreferences` to save
- Debounced saves prevent excessive database writes
- To avoid race conditions with concurrent saves, components fetch fresh preferences via `queryClient.getQueryData<UserPreferences>(['userPreferences'])` immediately before mutation
- Settings are merged with existing settings to preserve other components' data

## Email Integration

**Resend Email Service**
- Uses Replit Connectors for secure API key management (no hardcoded secrets)
- Meeting invites are sent automatically when scheduling meetings with external participants
- Email service preserves organizer's local timezone for accurate meeting time display
- Beautifully formatted HTML emails with OSReaper branding
- Graceful error handling - meeting creation succeeds even if email fails

## AI Assistant (Reaper)

**Overview**
- Platform-wide AI assistant accessible via floating button in the bottom-right corner
- Available to both CEOs and employees with role-appropriate context
- Powered by OpenAI via Replit AI Integrations (gpt-5 model)

**Database Schema**
- **assistant_conversations table**: Stores conversation metadata (userId, title, createdAt)
- **assistant_messages table**: Stores individual messages with role, content, and optional context

**Features**
- Persistent conversation history with ability to create multiple conversations
- Context enrichment with platform data (deals, tasks, users, documents)
- Role-based access filtering (CEOs see all data, employees see their assigned items)
- Automatic conversation title generation based on first message
- Markdown rendering for formatted responses

**API Endpoints**
- `GET /api/assistant/conversations` - List user's conversations
- `POST /api/assistant/conversations` - Create new conversation
- `DELETE /api/assistant/conversations/:id` - Delete conversation
- `GET /api/assistant/conversations/:id/messages` - Get conversation messages
- `POST /api/assistant/conversations/:id/messages` - Send message and get AI response

**Frontend Component**
- `ReaperAssistant.tsx` - Slide-out panel with conversation management
- Integrated globally via Layout component
- Auto-selects most recent conversation when opened

## Two-Factor Authentication (2FA)

**Overview**
- TOTP-based two-factor authentication using otplib and qrcode libraries
- Optional 2FA that can be enabled/disabled from user account settings
- QR code generation for authenticator app setup (Google Authenticator, Authy, etc.)

**Implementation Details**
- Backend routes: `/api/auth/2fa/setup` (generate secret + QR), `/api/auth/2fa/verify` (confirm setup), `/api/auth/2fa/disable` (turn off), `/api/auth/2fa/status` (check status)
- Login flow: After password verification, if 2FA enabled, user is prompted for TOTP code via `/api/auth/2fa/login-verify`
- Secrets stored securely in users table (twoFactorSecret column)
- Frontend UI integrated into Layout.tsx account settings Security tab

**Security Features**
- Invite-only registration: New users assigned 'pending' status, require CEO approval
- User suspension: Suspended users have sessions invalidated and cannot authenticate
- Role management: CEOs can modify user roles and status via User Management page

## Document Management

**Overview**
- Centralized document library for storing, organizing, and sharing deal-related documents
- Accessible via Document Library navigation in both CEO and Employee sidebars
- Full CRUD operations with file upload, search, filtering, and download

**Features**
- File upload with base64 encoding for database storage
- Category-based organization (Contracts, Financial Documents, Legal, Presentations, Reports, Other)
- Deal association for linking documents to specific deals
- Tag support for enhanced searchability
- Search and filter by filename, category, deal, or tags
- Archive/unarchive functionality
- Download capability for retrieving stored documents

**API Endpoints**
- `GET /api/documents` - List all accessible documents
- `GET /api/documents/:id` - Get single document details
- `GET /api/documents/deal/:dealId` - Get documents by deal
- `POST /api/documents` - Upload new document
- `PATCH /api/documents/:id` - Update document metadata
- `DELETE /api/documents/:id` - Delete document

## Audit Logging

**Overview**
- Platform-wide audit logging system for tracking all important user actions and system events
- Accessible via Audit Logs page in CEO sidebar under Administration section
- Logs authentication events, deal/task CRUD, document operations, and user management actions

**Database Schema**
- **audit_logs_table**: Stores audit entries with userId, userName, action, entityType, entityId, entityName, details (jsonb), ipAddress, userAgent, and createdAt timestamp

**Tracked Events**
- Authentication: login, login_2fa, 2fa_enabled, 2fa_disabled, user_signup
- User Management: user_approved, user_rejected, user_suspended, user_reactivated, role_changed
- Deals: deal_created, deal_updated, deal_deleted
- Tasks: task_created, task_updated, task_completed, task_deleted
- Documents: document_created, document_updated, document_archived
- Investors: investor_created, investor_updated, investor_deactivated

**Features**
- Filterable by user, entity type, and search query
- Summary statistics (total events, active users, auth events, today's events)
- Detailed view for individual log entries showing all captured data
- CSV export with proper escaping for compliance reporting
- CEO-only access for security

**API Endpoints**
- `GET /api/audit-logs` - List all audit logs (CEO only)
- `GET /api/audit-logs/:entityType/:entityId` - Get audit logs for specific entity