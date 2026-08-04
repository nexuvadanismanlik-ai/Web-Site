-- ============================================================
-- Nexuva OS — legacy schema backup (public)
-- Exported: 2026-08-04T10:39:45.437Z
-- Source  : Supabase project mjvqxhbgvnxtursxywbu (eu-central-1)
--
-- Reconstructed from the Postgres catalog (pg_catalog / pg_indexes),
-- schema only — the tables held no rows at export time.
-- ============================================================

-- ─── ENUM TYPES ───────────────────────────────────────────
CREATE TYPE "public"."ApiTokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "public"."BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM');
CREATE TYPE "public"."CompanyStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'BLOCKED', 'DELETED');
CREATE TYPE "public"."ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "public"."CustomerStatus" AS ENUM ('LEAD', 'CONTACTED', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'WON', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "public"."FeatureRequestStatus" AS ENUM ('EVALUATING', 'PLANNED', 'ROADMAP', 'DEVELOPMENT', 'RELEASED', 'REJECTED');
CREATE TYPE "public"."HealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE', 'MAINTENANCE');
CREATE TYPE "public"."IdentityType" AS ENUM ('SYSTEM', 'EMPLOYEE', 'COMPANY', 'END_USER', 'SERVICE');
CREATE TYPE "public"."IncidentSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "public"."IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "public"."JobRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "public"."JobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE "public"."LicenseStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRING', 'SUSPENDED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "public"."LicenseType" AS ENUM ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');
CREATE TYPE "public"."MenuLocation" AS ENUM ('HEADER', 'FOOTER');
CREATE TYPE "public"."NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'WHATSAPP', 'PUSH', 'WEBHOOK', 'SLACK', 'DISCORD', 'MICROSOFT_TEAMS');
CREATE TYPE "public"."NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BACKGROUND');
CREATE TYPE "public"."OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'WAITING_APPROVAL', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'OVERDUE', 'PARTIALLY_PAID');
CREATE TYPE "public"."ProductCategory" AS ENUM ('SAAS', 'INTERNAL_TOOL', 'AUTOMATION', 'AI', 'INFRASTRUCTURE', 'INTEGRATION', 'WEBSITE', 'MICROSERVICE', 'LIBRARY', 'EXPERIMENTAL');
CREATE TYPE "public"."ProductStatus" AS ENUM ('PLANNING', 'DEVELOPMENT', 'TESTING', 'PRODUCTION', 'MAINTENANCE', 'DEPRECATED', 'ARCHIVED');
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "public"."TemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "public"."TicketCategory" AS ENUM ('BUG', 'FEATURE_REQUEST', 'QUESTION', 'SUPPORT', 'INCIDENT', 'INTEGRATION', 'BILLING', 'ACCOUNT', 'OTHER');
CREATE TYPE "public"."TicketPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATION');
CREATE TYPE "public"."TicketStatus" AS ENUM ('NEW', 'ASSIGNED', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'IN_PROGRESS', 'TESTING', 'RESOLVED', 'CLOSED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "public"."UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'ARCHIVED');
CREATE TYPE "public"."WidgetStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- ─── TABLES ───────────────────────────────────────────────
CREATE TABLE "public"."_prisma_migrations" (
  "id" character varying(36) NOT NULL,
  "checksum" character varying(64) NOT NULL,
  "finished_at" timestamp with time zone,
  "migration_name" character varying(255) NOT NULL,
  "logs" text,
  "rolled_back_at" timestamp with time zone,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "applied_steps_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "public"."accounts" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "debit" numeric(14,2) DEFAULT 0 NOT NULL,
  "credit" numeric(14,2) DEFAULT 0 NOT NULL,
  "balance" numeric(14,2) DEFAULT 0 NOT NULL,
  "last_payment_at" timestamp(6) with time zone,
  "last_transaction_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."activity_logs" (
  "id" uuid NOT NULL,
  "user_id" uuid,
  "domain" text,
  "action" text NOT NULL,
  "description" text,
  "entity_type" text,
  "entity_id" uuid,
  "ip_address" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."api_tokens" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "token_hash" text NOT NULL,
  "scopes" text[],
  "expires_at" timestamp(6) with time zone,
  "last_used_at" timestamp(6) with time zone,
  "status" "ApiTokenStatus" DEFAULT 'ACTIVE'::"ApiTokenStatus" NOT NULL,
  "user_id" uuid,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid
);

CREATE TABLE "public"."audit_logs" (
  "id" uuid NOT NULL,
  "user_id" uuid,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "field" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "ip_address" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."automation_rules" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "trigger_event" text NOT NULL,
  "conditions" jsonb,
  "actions" jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."blogs" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "excerpt" text,
  "cover_image" text,
  "content" text,
  "category" text,
  "tags" text[],
  "author_id" uuid,
  "seo_title" text,
  "seo_description" text,
  "og_image" text,
  "canonical_url" text,
  "status" "ContentStatus" DEFAULT 'DRAFT'::"ContentStatus" NOT NULL,
  "published_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."companies" (
  "id" uuid NOT NULL,
  "company_name" text NOT NULL,
  "tax_number" text NOT NULL,
  "tax_office" text,
  "country" text NOT NULL,
  "city" text NOT NULL,
  "address" text,
  "phone" text NOT NULL,
  "email" text NOT NULL,
  "website" text,
  "logo" text,
  "status" "CompanyStatus" DEFAULT 'PASSIVE'::"CompanyStatus" NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."customer_contacts" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "title" text,
  "email" text,
  "phone" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."customer_health_scores" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "score" integer NOT NULL,
  "risk_level" text,
  "calculated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."customer_notes" (
  "id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "note_type" text NOT NULL,
  "note" text NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."customer_products" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "assigned_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."customer_tags" (
  "customer_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."customers" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "assigned_user_id" uuid,
  "customer_status" "CustomerStatus" DEFAULT 'LEAD'::"CustomerStatus" NOT NULL,
  "lead_source" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."dashboard_widgets" (
  "id" uuid NOT NULL,
  "dashboard_id" uuid NOT NULL,
  "widget_id" uuid NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "position_x" integer DEFAULT 0 NOT NULL,
  "position_y" integer DEFAULT 0 NOT NULL,
  "width" integer,
  "height" integer,
  "settings" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."dashboards" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "type" text,
  "owner_user_id" uuid,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."departments" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "parent_id" uuid,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."domain_events" (
  "id" uuid NOT NULL,
  "event_name" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "OutboxStatus" DEFAULT 'PENDING'::"OutboxStatus" NOT NULL,
  "published_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."domains" (
  "id" uuid NOT NULL,
  "domain" text NOT NULL,
  "provider" text,
  "ssl_status" text,
  "dns_provider" text,
  "cloudflare_zone" text,
  "renewal_date" timestamp(6) with time zone,
  "status" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."email_templates" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "subject" text NOT NULL,
  "html_body" text NOT NULL,
  "plain_text_body" text,
  "variables" jsonb,
  "language" text DEFAULT 'tr'::text NOT NULL,
  "status" "TemplateStatus" DEFAULT 'ACTIVE'::"TemplateStatus" NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."expenses" (
  "id" uuid NOT NULL,
  "expense_type" text NOT NULL,
  "vendor" text,
  "amount" numeric(14,2) NOT NULL,
  "currency" character varying(3) NOT NULL,
  "expense_date" timestamp(6) with time zone NOT NULL,
  "is_recurring" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."faqs" (
  "id" uuid NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "category" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."feature_requests" (
  "id" uuid NOT NULL,
  "company_id" uuid,
  "product_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "status" "FeatureRequestStatus" DEFAULT 'EVALUATING'::"FeatureRequestStatus" NOT NULL,
  "votes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."form_submissions" (
  "id" uuid NOT NULL,
  "form_id" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "ip_address" text,
  "lead_created" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."forms" (
  "id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "fields" jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."hero_sections" (
  "id" uuid NOT NULL,
  "page_id" uuid,
  "title" text NOT NULL,
  "subtitle" text,
  "description" text,
  "primary_button" text,
  "secondary_button" text,
  "background_image" text,
  "video" text,
  "status" "ContentStatus" DEFAULT 'DRAFT'::"ContentStatus" NOT NULL,
  "published_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."in_app_notifications" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "type" text,
  "priority" "NotificationPriority" DEFAULT 'MEDIUM'::"NotificationPriority" NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."incident_tickets" (
  "incident_id" uuid NOT NULL,
  "ticket_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."incidents" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "severity" "IncidentSeverity" DEFAULT 'MEDIUM'::"IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" DEFAULT 'OPEN'::"IncidentStatus" NOT NULL,
  "started_at" timestamp(6) with time zone,
  "resolved_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."invoices" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "subscription_id" uuid,
  "invoice_number" text NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" character varying(3) NOT NULL,
  "tax_amount" numeric(14,2),
  "status" "InvoiceStatus" DEFAULT 'DRAFT'::"InvoiceStatus" NOT NULL,
  "due_date" timestamp(6) with time zone,
  "paid_date" timestamp(6) with time zone,
  "external_reference" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."job_runs" (
  "id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "status" "JobRunStatus" DEFAULT 'RUNNING'::"JobRunStatus" NOT NULL,
  "started_at" timestamp(6) with time zone,
  "completed_at" timestamp(6) with time zone,
  "error_message" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."jobs" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "schedule" text NOT NULL,
  "last_run_at" timestamp(6) with time zone,
  "next_run_at" timestamp(6) with time zone,
  "status" "JobStatus" DEFAULT 'ACTIVE'::"JobStatus" NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."knowledge_articles" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "content" text NOT NULL,
  "category" text,
  "tags" text[],
  "product_id" uuid,
  "author_id" uuid,
  "version" text,
  "published_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."license_history" (
  "id" uuid NOT NULL,
  "license_id" uuid NOT NULL,
  "field" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "changed_by" uuid,
  "changed_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."licenses" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "license_type" "LicenseType" NOT NULL,
  "status" "LicenseStatus" DEFAULT 'DRAFT'::"LicenseStatus" NOT NULL,
  "license_key" text NOT NULL,
  "user_limit" integer,
  "storage_limit" bigint,
  "start_date" timestamp(6) with time zone,
  "expire_date" timestamp(6) with time zone,
  "renew_date" timestamp(6) with time zone,
  "next_invoice_date" timestamp(6) with time zone,
  "is_trial" boolean DEFAULT false NOT NULL,
  "auto_renew" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."media" (
  "id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "original_name" text,
  "path" text NOT NULL,
  "mime_type" text,
  "size" bigint,
  "alt_text" text,
  "tags" text[],
  "uploaded_by" uuid,
  "uploaded_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."menu_items" (
  "id" uuid NOT NULL,
  "menu_id" uuid NOT NULL,
  "parent_id" uuid,
  "title" text NOT NULL,
  "url" text,
  "icon" text,
  "target" text,
  "order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."menus" (
  "id" uuid NOT NULL,
  "location" "MenuLocation" NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."notification_logs" (
  "id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "attempt" integer NOT NULL,
  "status" "DeliveryStatus" NOT NULL,
  "provider_response" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."notification_preferences" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "category" text NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);

CREATE TABLE "public"."notifications" (
  "id" uuid NOT NULL,
  "recipient" text NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "template_code" text,
  "subject" text,
  "body" text,
  "priority" "NotificationPriority" DEFAULT 'MEDIUM'::"NotificationPriority" NOT NULL,
  "status" "DeliveryStatus" DEFAULT 'QUEUED'::"DeliveryStatus" NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "scheduled_at" timestamp(6) with time zone,
  "delivered_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."page_components" (
  "id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  "type" text NOT NULL,
  "props" jsonb,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."pages" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "content" jsonb,
  "status" "ContentStatus" DEFAULT 'DRAFT'::"ContentStatus" NOT NULL,
  "published_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."password_history" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."payments" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "license_id" uuid,
  "invoice_id" uuid,
  "currency" character varying(3) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "payment_method" text,
  "reference_number" text,
  "status" "PaymentStatus" DEFAULT 'PENDING'::"PaymentStatus" NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."permissions" (
  "id" uuid NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "resource" text NOT NULL,
  "action" text NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."policies" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "permission_code" text NOT NULL,
  "condition_expression" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."product_apis" (
  "id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "base_url" text NOT NULL,
  "api_version" text,
  "swagger_url" text,
  "health_endpoint" text,
  "auth_type" text,
  "timeout" integer,
  "rate_limit" integer,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."product_dependencies" (
  "product_id" uuid NOT NULL,
  "depends_on_product_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."product_domains" (
  "product_id" uuid NOT NULL,
  "domain_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."product_health" (
  "id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "status" "HealthStatus" NOT NULL,
  "response_time" integer,
  "message" text,
  "checked_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."product_versions" (
  "id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "version" text NOT NULL,
  "release_date" timestamp(6) with time zone,
  "release_type" text,
  "description" text,
  "breaking_changes" text,
  "migration_notes" text,
  "rollback_version" text,
  "status" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."products" (
  "id" uuid NOT NULL,
  "product_code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" "ProductCategory" NOT NULL,
  "current_version" text,
  "release_date" timestamp(6) with time zone,
  "status" "ProductStatus" DEFAULT 'PLANNING'::"ProductStatus" NOT NULL,
  "owner_team" text,
  "repository" text,
  "documentation_url" text,
  "support_email" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."references" (
  "id" uuid NOT NULL,
  "company_name" text NOT NULL,
  "logo" text,
  "category" text,
  "website" text,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "ContentStatus" DEFAULT 'DRAFT'::"ContentStatus" NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."revenues" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "payment_id" uuid,
  "revenue_type" text NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" character varying(3) NOT NULL,
  "recorded_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "approved_by" uuid,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."roles" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."security_events" (
  "id" uuid NOT NULL,
  "type" text NOT NULL,
  "user_id" uuid,
  "ip_address" text,
  "details" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."seo_settings" (
  "id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "title" text,
  "description" text,
  "keywords" text,
  "canonical" text,
  "robots" text,
  "og" jsonb,
  "twitter" jsonb,
  "schema" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."sessions" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "device" text,
  "browser" text,
  "os" text,
  "country" text,
  "ip_address" text,
  "last_activity" timestamp(6) with time zone,
  "expired_at" timestamp(6) with time zone,
  "revoked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."settings" (
  "id" uuid NOT NULL,
  "key" text NOT NULL,
  "value" text,
  "group" text,
  "is_encrypted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."sliders" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "description" text,
  "image" text,
  "mobile_image" text,
  "button_text" text,
  "button_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "ContentStatus" DEFAULT 'DRAFT'::"ContentStatus" NOT NULL,
  "start_date" timestamp(6) with time zone,
  "end_date" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."social_links" (
  "id" uuid NOT NULL,
  "platform" text NOT NULL,
  "url" text NOT NULL,
  "icon" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."subscriptions" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "license_id" uuid NOT NULL,
  "billing_cycle" "BillingCycle" NOT NULL,
  "renew_date" timestamp(6) with time zone,
  "next_payment" timestamp(6) with time zone,
  "auto_renew" boolean DEFAULT false NOT NULL,
  "status" "SubscriptionStatus" DEFAULT 'ACTIVE'::"SubscriptionStatus" NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."tags" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."teams" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."ticket_messages" (
  "id" uuid NOT NULL,
  "ticket_id" uuid NOT NULL,
  "sender_id" uuid,
  "message" text NOT NULL,
  "is_internal" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."tickets" (
  "id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "product_id" uuid,
  "reporter_id" uuid,
  "assigned_to" uuid,
  "category" "TicketCategory" NOT NULL,
  "priority" "TicketPriority" DEFAULT 'MEDIUM'::"TicketPriority" NOT NULL,
  "status" "TicketStatus" DEFAULT 'NEW'::"TicketStatus" NOT NULL,
  "subject" text NOT NULL,
  "description" text,
  "sla_due_at" timestamp(6) with time zone,
  "closed_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."user_roles" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."user_teams" (
  "user_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."users" (
  "id" uuid NOT NULL,
  "identity_type" "IdentityType" NOT NULL,
  "company_id" uuid,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text,
  "status" "UserStatus" DEFAULT 'INVITED'::"UserStatus" NOT NULL,
  "last_login" timestamp(6) with time zone,
  "mfa_enabled" boolean DEFAULT false NOT NULL,
  "mfa_secret" text,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

CREATE TABLE "public"."widgets" (
  "id" uuid NOT NULL,
  "widget_name" text NOT NULL,
  "category" text,
  "icon" text,
  "permission_code" text,
  "refresh_interval" integer,
  "data_source" text,
  "status" "WidgetStatus" DEFAULT 'ACTIVE'::"WidgetStatus" NOT NULL,
  "default_width" integer,
  "default_height" integer,
  "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "updated_by" uuid,
  "deleted_at" timestamp(6) with time zone,
  "deleted_by" uuid
);

-- ─── CONSTRAINTS ──────────────────────────────────────────
ALTER TABLE "public"."_prisma_migrations" ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."api_tokens" ADD CONSTRAINT "api_tokens_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."automation_rules" ADD CONSTRAINT "automation_rules_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."blogs" ADD CONSTRAINT "blogs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."companies" ADD CONSTRAINT "companies_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."customer_contacts" ADD CONSTRAINT "customer_contacts_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."customer_health_scores" ADD CONSTRAINT "customer_health_scores_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."customer_notes" ADD CONSTRAINT "customer_notes_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."customer_products" ADD CONSTRAINT "customer_products_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."customer_tags" ADD CONSTRAINT "customer_tags_pkey" PRIMARY KEY (customer_id, tag_id);
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."dashboards" ADD CONSTRAINT "dashboards_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."domain_events" ADD CONSTRAINT "domain_events_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."domains" ADD CONSTRAINT "domains_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."faqs" ADD CONSTRAINT "faqs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."feature_requests" ADD CONSTRAINT "feature_requests_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."form_submissions" ADD CONSTRAINT "form_submissions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."forms" ADD CONSTRAINT "forms_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."hero_sections" ADD CONSTRAINT "hero_sections_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."incident_tickets" ADD CONSTRAINT "incident_tickets_pkey" PRIMARY KEY (incident_id, ticket_id);
ALTER TABLE "public"."incidents" ADD CONSTRAINT "incidents_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."job_runs" ADD CONSTRAINT "job_runs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."knowledge_articles" ADD CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."license_history" ADD CONSTRAINT "license_history_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."licenses" ADD CONSTRAINT "licenses_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."media" ADD CONSTRAINT "media_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."notification_logs" ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."notification_preferences" ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."page_components" ADD CONSTRAINT "page_components_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."pages" ADD CONSTRAINT "pages_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."password_history" ADD CONSTRAINT "password_history_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."permissions" ADD CONSTRAINT "permissions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."product_apis" ADD CONSTRAINT "product_apis_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."product_dependencies" ADD CONSTRAINT "product_dependencies_pkey" PRIMARY KEY (product_id, depends_on_product_id);
ALTER TABLE "public"."product_domains" ADD CONSTRAINT "product_domains_pkey" PRIMARY KEY (product_id, domain_id);
ALTER TABLE "public"."product_health" ADD CONSTRAINT "product_health_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."product_versions" ADD CONSTRAINT "product_versions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."references" ADD CONSTRAINT "references_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."revenues" ADD CONSTRAINT "revenues_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY (role_id, permission_id);
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."security_events" ADD CONSTRAINT "security_events_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."seo_settings" ADD CONSTRAINT "seo_settings_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."sliders" ADD CONSTRAINT "sliders_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."social_links" ADD CONSTRAINT "social_links_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."tags" ADD CONSTRAINT "tags_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."ticket_messages" ADD CONSTRAINT "ticket_messages_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (user_id, role_id);
ALTER TABLE "public"."user_teams" ADD CONSTRAINT "user_teams_pkey" PRIMARY KEY (user_id, team_id);
ALTER TABLE "public"."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."widgets" ADD CONSTRAINT "widgets_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."customer_contacts" ADD CONSTRAINT "customer_contacts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."customer_health_scores" ADD CONSTRAINT "customer_health_scores_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."customer_products" ADD CONSTRAINT "customer_products_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."customer_products" ADD CONSTRAINT "customer_products_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."customer_tags" ADD CONSTRAINT "customer_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_widget_id_fkey" FOREIGN KEY (widget_id) REFERENCES widgets(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."feature_requests" ADD CONSTRAINT "feature_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."feature_requests" ADD CONSTRAINT "feature_requests_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."hero_sections" ADD CONSTRAINT "hero_sections_page_id_fkey" FOREIGN KEY (page_id) REFERENCES pages(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."incident_tickets" ADD CONSTRAINT "incident_tickets_incident_id_fkey" FOREIGN KEY (incident_id) REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."incident_tickets" ADD CONSTRAINT "incident_tickets_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."job_runs" ADD CONSTRAINT "job_runs_job_id_fkey" FOREIGN KEY (job_id) REFERENCES jobs(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."license_history" ADD CONSTRAINT "license_history_license_id_fkey" FOREIGN KEY (license_id) REFERENCES licenses(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."licenses" ADD CONSTRAINT "licenses_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."licenses" ADD CONSTRAINT "licenses_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY (menu_id) REFERENCES menus(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."notification_logs" ADD CONSTRAINT "notification_logs_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES notifications(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."page_components" ADD CONSTRAINT "page_components_page_id_fkey" FOREIGN KEY (page_id) REFERENCES pages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_license_id_fkey" FOREIGN KEY (license_id) REFERENCES licenses(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."product_apis" ADD CONSTRAINT "product_apis_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."product_dependencies" ADD CONSTRAINT "product_dependencies_depends_on_product_id_fkey" FOREIGN KEY (depends_on_product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."product_dependencies" ADD CONSTRAINT "product_dependencies_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."product_domains" ADD CONSTRAINT "product_domains_domain_id_fkey" FOREIGN KEY (domain_id) REFERENCES domains(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."product_domains" ADD CONSTRAINT "product_domains_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."product_health" ADD CONSTRAINT "product_health_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."product_versions" ADD CONSTRAINT "product_versions_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."revenues" ADD CONSTRAINT "revenues_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."revenues" ADD CONSTRAINT "revenues_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_license_id_fkey" FOREIGN KEY (license_id) REFERENCES licenses(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."user_teams" ADD CONSTRAINT "user_teams_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."user_teams" ADD CONSTRAINT "user_teams_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ─── INDEXES ──────────────────────────────────────────────
CREATE UNIQUE INDEX accounts_company_id_key ON public.accounts USING btree (company_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs USING btree (created_at);
CREATE INDEX activity_logs_user_id_idx ON public.activity_logs USING btree (user_id);
CREATE INDEX api_tokens_user_id_idx ON public.api_tokens USING btree (user_id);
CREATE INDEX audit_logs_entity_type_entity_id_idx ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX automation_rules_trigger_event_idx ON public.automation_rules USING btree (trigger_event);
CREATE UNIQUE INDEX blogs_slug_key ON public.blogs USING btree (slug);
CREATE INDEX blogs_status_idx ON public.blogs USING btree (status);
CREATE UNIQUE INDEX companies_tax_number_key ON public.companies USING btree (tax_number);
CREATE INDEX customer_contacts_company_id_idx ON public.customer_contacts USING btree (company_id);
CREATE INDEX customer_health_scores_company_id_idx ON public.customer_health_scores USING btree (company_id);
CREATE INDEX customer_notes_customer_id_idx ON public.customer_notes USING btree (customer_id);
CREATE UNIQUE INDEX customer_products_company_id_product_id_key ON public.customer_products USING btree (company_id, product_id);
CREATE INDEX customer_products_product_id_idx ON public.customer_products USING btree (product_id);
CREATE INDEX customer_tags_tag_id_idx ON public.customer_tags USING btree (tag_id);
CREATE INDEX customers_assigned_user_id_idx ON public.customers USING btree (assigned_user_id);
CREATE UNIQUE INDEX customers_company_id_key ON public.customers USING btree (company_id);
CREATE INDEX customers_customer_status_idx ON public.customers USING btree (customer_status);
CREATE INDEX dashboard_widgets_dashboard_id_idx ON public.dashboard_widgets USING btree (dashboard_id);
CREATE INDEX dashboard_widgets_widget_id_idx ON public.dashboard_widgets USING btree (widget_id);
CREATE INDEX dashboards_owner_user_id_idx ON public.dashboards USING btree (owner_user_id);
CREATE INDEX departments_parent_id_idx ON public.departments USING btree (parent_id);
CREATE INDEX domain_events_aggregate_type_aggregate_id_idx ON public.domain_events USING btree (aggregate_type, aggregate_id);
CREATE INDEX domain_events_status_idx ON public.domain_events USING btree (status);
CREATE UNIQUE INDEX domains_domain_key ON public.domains USING btree (domain);
CREATE UNIQUE INDEX email_templates_code_key ON public.email_templates USING btree (code);
CREATE INDEX feature_requests_company_id_idx ON public.feature_requests USING btree (company_id);
CREATE INDEX feature_requests_product_id_idx ON public.feature_requests USING btree (product_id);
CREATE INDEX form_submissions_form_id_idx ON public.form_submissions USING btree (form_id);
CREATE UNIQUE INDEX forms_code_key ON public.forms USING btree (code);
CREATE INDEX hero_sections_page_id_idx ON public.hero_sections USING btree (page_id);
CREATE INDEX in_app_notifications_user_id_is_read_idx ON public.in_app_notifications USING btree (user_id, is_read);
CREATE INDEX incident_tickets_ticket_id_idx ON public.incident_tickets USING btree (ticket_id);
CREATE INDEX invoices_company_id_idx ON public.invoices USING btree (company_id);
CREATE INDEX invoices_subscription_id_idx ON public.invoices USING btree (subscription_id);
CREATE INDEX job_runs_job_id_idx ON public.job_runs USING btree (job_id);
CREATE UNIQUE INDEX jobs_name_key ON public.jobs USING btree (name);
CREATE INDEX knowledge_articles_product_id_idx ON public.knowledge_articles USING btree (product_id);
CREATE UNIQUE INDEX knowledge_articles_slug_key ON public.knowledge_articles USING btree (slug);
CREATE INDEX license_history_license_id_idx ON public.license_history USING btree (license_id);
CREATE INDEX licenses_company_id_product_id_idx ON public.licenses USING btree (company_id, product_id);
CREATE UNIQUE INDEX licenses_company_product_active_unique ON public.licenses USING btree (company_id, product_id) WHERE ((status = 'ACTIVE'::"LicenseStatus") AND (deleted_at IS NULL));
CREATE UNIQUE INDEX licenses_license_key_key ON public.licenses USING btree (license_key);
CREATE INDEX licenses_product_id_idx ON public.licenses USING btree (product_id);
CREATE INDEX licenses_status_idx ON public.licenses USING btree (status);
CREATE INDEX menu_items_menu_id_idx ON public.menu_items USING btree (menu_id);
CREATE INDEX menu_items_parent_id_idx ON public.menu_items USING btree (parent_id);
CREATE INDEX notification_logs_notification_id_idx ON public.notification_logs USING btree (notification_id);
CREATE UNIQUE INDEX notification_preferences_user_id_channel_category_key ON public.notification_preferences USING btree (user_id, channel, category);
CREATE INDEX notifications_status_scheduled_at_idx ON public.notifications USING btree (status, scheduled_at);
CREATE INDEX page_components_page_id_idx ON public.page_components USING btree (page_id);
CREATE UNIQUE INDEX pages_slug_key ON public.pages USING btree (slug);
CREATE INDEX password_history_user_id_idx ON public.password_history USING btree (user_id);
CREATE INDEX payments_company_id_idx ON public.payments USING btree (company_id);
CREATE INDEX payments_invoice_id_idx ON public.payments USING btree (invoice_id);
CREATE INDEX payments_license_id_idx ON public.payments USING btree (license_id);
CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);
CREATE UNIQUE INDEX policies_name_key ON public.policies USING btree (name);
CREATE INDEX policies_permission_code_idx ON public.policies USING btree (permission_code);
CREATE INDEX product_apis_product_id_idx ON public.product_apis USING btree (product_id);
CREATE INDEX product_dependencies_depends_on_product_id_idx ON public.product_dependencies USING btree (depends_on_product_id);
CREATE INDEX product_domains_domain_id_idx ON public.product_domains USING btree (domain_id);
CREATE INDEX product_health_product_id_idx ON public.product_health USING btree (product_id);
CREATE INDEX product_versions_product_id_idx ON public.product_versions USING btree (product_id);
CREATE UNIQUE INDEX product_versions_product_id_version_key ON public.product_versions USING btree (product_id, version);
CREATE UNIQUE INDEX products_product_code_key ON public.products USING btree (product_code);
CREATE INDEX revenues_company_id_idx ON public.revenues USING btree (company_id);
CREATE INDEX revenues_payment_id_idx ON public.revenues USING btree (payment_id);
CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions USING btree (permission_id);
CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);
CREATE INDEX security_events_type_idx ON public.security_events USING btree (type);
CREATE INDEX security_events_user_id_idx ON public.security_events USING btree (user_id);
CREATE INDEX seo_settings_entity_type_entity_id_idx ON public.seo_settings USING btree (entity_type, entity_id);
CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);
CREATE UNIQUE INDEX settings_key_key ON public.settings USING btree (key);
CREATE INDEX subscriptions_company_id_idx ON public.subscriptions USING btree (company_id);
CREATE UNIQUE INDEX subscriptions_license_id_key ON public.subscriptions USING btree (license_id);
CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);
CREATE INDEX teams_department_id_idx ON public.teams USING btree (department_id);
CREATE INDEX ticket_messages_ticket_id_idx ON public.ticket_messages USING btree (ticket_id);
CREATE INDEX tickets_assigned_to_idx ON public.tickets USING btree (assigned_to);
CREATE INDEX tickets_company_id_idx ON public.tickets USING btree (company_id);
CREATE INDEX tickets_product_id_idx ON public.tickets USING btree (product_id);
CREATE INDEX tickets_status_idx ON public.tickets USING btree (status);
CREATE INDEX user_roles_role_id_idx ON public.user_roles USING btree (role_id);
CREATE INDEX user_teams_team_id_idx ON public.user_teams USING btree (team_id);
CREATE INDEX users_company_id_idx ON public.users USING btree (company_id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX users_identity_type_idx ON public.users USING btree (identity_type);
