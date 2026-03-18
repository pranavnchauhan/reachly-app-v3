"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function ClientActions({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/admin/delete-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });

    if (res.ok) {
      router.push("/admin/clients");
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
    setDeleting(false);
    setShowModal(false);
  }

  return (
    <>
      <button onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-danger/5 border border-danger/20 text-danger hover:bg-danger/10 transition-colors">
        <Trash2 className="w-3 h-3" /> Delete Client
      </button>

      {showModal && (
        <ConfirmModal
          open={true}
          title={`Delete ${companyName}?`}
          message={`This will:\n\n• Remove the company record\n• Orphan all niches and leads (they can be reassigned)\n• Users will remain but lose their company association\n\nThis cannot be undone.`}
          severity="danger"
          confirmLabel={deleting ? "Deleting..." : "Delete Client"}
          onConfirm={handleDelete}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
