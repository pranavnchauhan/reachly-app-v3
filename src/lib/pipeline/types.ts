// Shared types for the lead pipeline

export interface SourcedCompany {
  name: string;
  domain: string | null;
  industry: string;
  employee_count: number | null;
  location: string | null;
  description: string | null;
  apollo_id: string;
}

export interface SignalResult {
  company: SourcedCompany;
  matched_signals: {
    signal_id: string;
    signal_name: string;
    evidence: string;
    confidence: number;
    source_url?: string | null;
  }[];
  total_score: number;
}
