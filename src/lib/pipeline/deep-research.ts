// Step 4: Deep research via Perplexity (contact background) + Claude (justification, strategies, emails)

import type { EnrichedLead } from "./enrich-contacts";
import type { ApproachStrategy, GeneratedEmail } from "@/types/database";
import { safeFetchJson } from "./safe-fetch";

export interface ResearchedLead extends EnrichedLead {
  justification: string;
  contact_summary: string;
  approach_strategies: ApproachStrategy[];
  email_templates: GeneratedEmail[];
}

export async function deepResearch(
  leads: EnrichedLead[],
  nicheDescription: string
): Promise<ResearchedLead[]> {
  const results: ResearchedLead[] = [];

  for (const lead of leads) {
    try {
      const contactSummary = await getContactBackground(lead);
      const analysis = await generateAnalysis(lead, contactSummary, nicheDescription);

      results.push({
        ...lead,
        justification: analysis.justification || "Signal-matched lead",
        contact_summary: contactSummary,
        approach_strategies: analysis.strategies,
        email_templates: analysis.emails,
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`Deep research failed for ${lead.company.name}:`, error);
      // Still add the lead with minimal data
      results.push({
        ...lead,
        justification: "Signal-matched lead (research pending)",
        contact_summary: "",
        approach_strategies: [],
        email_templates: [],
      });
    }
  }

  return results;
}

async function getContactBackground(lead: EnrichedLead): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";

  const prompt = `Research ${lead.contact.name}, ${lead.contact.title} at ${lead.company.name}${lead.contact.linkedin_url ? ` (LinkedIn: ${lead.contact.linkedin_url})` : ""}.

Provide a brief professional summary (3-4 sentences) covering their career background, expertise, and likely priorities. Keep it factual and concise.`;

  const { ok, data } = await safeFetchJson(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a professional B2B researcher. Be factual and concise." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    }
  );

  if (!ok) return "";
  const choices = data.choices as Record<string, Record<string, string>>[] | undefined;
  return choices?.[0]?.message?.content || "";
}

async function generateAnalysis(
  lead: EnrichedLead,
  contactSummary: string,
  nicheDescription: string
): Promise<{
  justification: string;
  strategies: ApproachStrategy[];
  emails: GeneratedEmail[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { justification: "", strategies: [], emails: [] };

  const signalEvidence = lead.matched_signals
    .map((s) => `- ${s.signal_name} (${Math.round(s.confidence * 100)}%): ${s.evidence}`)
    .join("\n");

  const prompt = `You are helping a B2B service provider in "${nicheDescription}" reach out to potential clients.

COMPANY: ${lead.company.name}
INDUSTRY: ${lead.company.industry}
SIZE: ${lead.company.employee_count || "Unknown"} employees
LOCATION: ${lead.company.location || "Unknown"}
WEBSITE: ${lead.company.domain || "Unknown"}

CONTACT: ${lead.contact.name}, ${lead.contact.title}
CONTACT BACKGROUND: ${contactSummary || "No background available"}

BUYING SIGNALS:
${signalEvidence}

Generate JSON with exactly this structure:
{
  "justification": "2-3 sentences on why this company is a strong prospect, referencing signals",
  "strategies": [
    {"name": "Strategy name", "description": "One sentence", "talking_points": ["point 1", "point 2", "point 3"]}
  ],
  "emails": [
    {"approach": "Approach name", "subject": "Subject line", "body": "Email body under 150 words using {{contact_name}} and {{company}}"}
  ]
}

Provide exactly 3 strategies and 3 emails. Be specific to this company.`;

  const { ok, data } = await safeFetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!ok) {
    console.error("Claude API error:", data.error || data);
    return { justification: "", strategies: [], emails: [] };
  }

  const content = ((data.content as Record<string, string>[]) || [])[0]?.text || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { justification: "", strategies: [], emails: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      justification: parsed.justification || "",
      strategies: parsed.strategies || [],
      emails: parsed.emails || [],
    };
  } catch {
    return { justification: "", strategies: [], emails: [] };
  }
}
