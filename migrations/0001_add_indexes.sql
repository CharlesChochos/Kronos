-- Performance indexes for frequently queried fields

-- Deals table indexes
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_deal_type ON deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_deals_sector ON deals(sector);
CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(lead);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);

-- Tasks table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_access_level ON users(access_level);

-- Deal fees table indexes
CREATE INDEX IF NOT EXISTS idx_deal_fees_deal_id ON deal_fees(deal_id);

-- Stage documents table indexes
CREATE INDEX IF NOT EXISTS idx_stage_documents_deal_id ON stage_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_stage_documents_stage ON stage_documents(stage);

-- Stage pod members table indexes
CREATE INDEX IF NOT EXISTS idx_stage_pod_members_deal_id ON stage_pod_members(deal_id);
CREATE INDEX IF NOT EXISTS idx_stage_pod_members_stage ON stage_pod_members(stage);

-- CRM Investors table indexes
CREATE INDEX IF NOT EXISTS idx_crm_investors_name ON crm_investors(name);
CREATE INDEX IF NOT EXISTS idx_crm_investors_firm ON crm_investors(firm);
CREATE INDEX IF NOT EXISTS idx_crm_investors_type ON crm_investors(type);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Events/Calendar table indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_deal_id ON events(deal_id);

-- OKRs table indexes
CREATE INDEX IF NOT EXISTS idx_okrs_user_id ON okrs(user_id);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON okrs(status);
