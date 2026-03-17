// Step 4: Deep research via Perplexity (contact background) + Claude (justification, strategies, emails)

import type { EnrichedLead } from "./enrich-contacts";
import type { ApproachStrategy, GeneratedEmail } from "@/types/database";

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

  // Process sequentially to manage rate limits
  for (const lead of leads) {
    try {
      // Step A: Get contact background from Perplexity
      const contactSummary = await getContactBackground(lead);

      // Step B: Generate justification, strategies, emails via Claude
      const analysis = await generateAnalysis(lead, contactSummary, nicheDescription);

      results.push({
        ...lead,
        justification: analysis.justification,
        contact_summary: contactSummary,
        approach_strategies: analysis.strategies,
        email_templates: analysis.emails,
      });

      // Pause between leads
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`Deep research failed for ${lead.company.name}:`, error);
    }
  }

  return results;
}

async function getContactBackground(lead: EnrichedLead): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";

  const prompt = `Research ${lead.contact.name}, ${lead.contact.title} at ${lead.company.name}${lead.contact.linkedin_url ? ` (LinkedIn: ${lead.contact.linkedin_url})` : ""}.

Provide a brief professional summary (3-4 sentences) covering:
- Their career background and expertise
- How long they've been at ${lead.company.name}
- Any notable achievements, publications, or speaking engagements
- Their likely priorities based on their role

Keep it factual and concise. If you can't find information, say so briefly.`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a professional B2B researcher. Be factual and concise.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) return "";
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
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
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const signalEvidence = lead.matched_signals
    .map((s) => `- ${s.signal_name} (${Math.round(s.confidence * 100)}% confidence): ${s.evidence}`)
    .join("\n");

  const prompt = `You are helping a B2B service provider in "${nicheDescription}" reach out to potential clients.

COMPANY: ${lead.company.name}
INDUSTRY: ${lead.company.industry}
SIZE: ${lead.company.employee_count || "Unknown"} employees
LOCATION: ${lead.company.location || "Unknown"}
WEBSITE: ${lead.company.domain || "Unknown"}

CONTACT: ${lead.contact.name}, ${lead.contact.title}
CONTACT BACKGROUND: ${contactSummary || "No background information available"}

BUYING SIGNALS DETECTED:
${signalEvidence}

Generate the following in JSON format:

{
  "justification": "2-3 sentences explaining why this company is a strong prospect right now, referencing specific signals",
  "strategies": [
    {
      "name": "Strategy name",
      "description": "One sentence describing the approach",
      "talking_points": ["point 1", "point 2", "point 3"]
    }
  ],
  "emails": [
    {
      "approach": "Approach name matching strategy",
      "subject": "Email subject line",
      "body": "Full email body (use {{contact_name}} and {{company}} as variables, keep under 150 words, be personal and specific)"
    }
  ]
}

Requirements:
- Provide exactly 3 different strategies (e.g., Direct Value Prop, Thought Leadership, Mutual Connection)
- Provide 3 email templates, one per strategy
- Reference specific signals and evidence in the justification
- Emails should be conversational, not salesy
- Talking points should be specific to this company, not generic`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`Claude API error ${response.status}: ${responseText.slice(0, 200)}`);
    // Return empty but don't throw — let other leads continue
    return { justification: "", strategies: [], emails: [] };
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error(`Claude returned non-JSON: ${responseText.slice(0, 200)}`);
    return { justification: "", strategies: [], emails: [] };
  }

  const content = data.content?.[0]?.text || "";

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { justification: "", strategies: [], emails: [] };
  }

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
