export type UserRole = "admin" | "client";

export type LeadStatus = "discovered" | "validated" | "published" | "revealed" | "disputed" | "refunded";

export type SignalRequestStatus = "pending" | "approved" | "rejected";

export type CreditTransactionType = "purchase" | "debit" | "refund";

// Use a simple type alias until we generate types from Supabase CLI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

// Supporting types
export interface Signal {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
}

export interface EmailTemplate {
  id: string;
  approach: string;
  subject: string;
  body: string;
}

export interface MatchedSignal {
  signal_id: string;
  signal_name: string;
  evidence: string;
  confidence: number;
}

export interface ApproachStrategy {
  name: string;
  description: string;
  talking_points: string[];
}

export interface GeneratedEmail {
  approach: string;
  subject: string;
  body: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
