"use client";

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  severity: "info" | "warning" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  severity,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const iconMap = {
    info: <Info className="w-6 h-6 text-primary" />,
    warning: <AlertTriangle className="w-6 h-6 text-warning" />,
    danger: <ShieldAlert className="w-6 h-6 text-danger" />,
  };

  const confirmBtnClass = {
    info: "bg-primary hover:bg-primary-hover",
    warning: "bg-warning hover:bg-warning/90",
    danger: "bg-danger hover:bg-danger/90",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 mt-0.5">{iconMap[severity]}</div>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>

        {/* Message */}
        <div className="text-sm text-muted leading-relaxed whitespace-pre-line mb-6 pl-9">
          {message}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-background transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors ${confirmBtnClass[severity]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
