export type UserRole = "admin" | "staff" | "client";

export type LeadStatus = "discovered" | "validated" | "published" | "revealed" | "disputed" | "refunded";

export type LeadDisposition = "revealed" | "contacted" | "meeting_booked" | "proposal_sent" | "won" | "lost" | "parked";

export type NoteType = "note" | "contacted" | "voicemail" | "email_sent" | "meeting" | "status_change";

export interface LeadNote {
  id: string;
  lead_id: string;
  client_id: string;
  type: NoteType;
  content: string;
  created_at: string;
}

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
  approach: string;
  subject: string;
  body: string;
}

export type LeadSource = "perplexity";

export interface MatchedSignal {
  signal_id: string;
  signal_name: string;
  evidence: string;
  confidence: number;
  source_url?: string | null;
}

export interface ApproachStrategy {
  name: string;
  description: string;
  talking_points: string[];
}

// Alias — pipeline uses GeneratedEmail, niche editor uses EmailTemplate (same shape)
export type GeneratedEmail = EmailTemplate;

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
