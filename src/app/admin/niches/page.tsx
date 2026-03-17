export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function NicheTemplatesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("niche_templates")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Niche Templates</h1>
        <Link
          href="/admin/niches/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </Link>
      </div>

      {!templates?.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted mb-4">No niche templates yet. Create your first one to start generating leads.</p>
          <Link
            href="/admin/niches/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/admin/niches/${template.id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  <p className="text-sm text-muted mt-1">{template.description}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {template.industries?.slice(0, 3).map((ind: string) => (
                      <span key={ind} className="text-xs bg-primary-light text-primary px-2 py-1 rounded-full">
                        {ind}
                      </span>
                    ))}
                    {(template.industries?.length ?? 0) > 3 && (
                      <span className="text-xs text-muted">+{template.industries.length - 3} more</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${template.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>
                  {template.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted">
                <span>{(template.signals as unknown[])?.length ?? 0} signals</span>
                <span>{template.target_titles?.length ?? 0} target titles</span>
                <span>{template.employee_min}–{template.employee_max} employees</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
