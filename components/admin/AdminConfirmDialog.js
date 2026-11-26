"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, X, Loader2 } from "lucide-react";

export default function AdminConfirmDialog({
  open,
  title = "Confirm Action",
  description = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  loading = false,
  onConfirm,
  onCancel
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const cancelHandlerRef = useRef(onCancel);
  const loadingRef = useRef(loading);

  useEffect(() => {
    cancelHandlerRef.current = onCancel;
    loadingRef.current = loading;
  }, [onCancel, loading]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loadingRef.current) {
        event.preventDefault();
        cancelHandlerRef.current?.();
      }
      if (event.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        );
        if (!elements?.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const isDanger = variant === "danger";
  const isInfo = variant === "info";
  const Icon = isInfo ? Info : AlertTriangle;
  const iconClass = isDanger
    ? "bg-red-50 text-red-600"
    : "bg-[#FFF1EC] text-[#F6490D]";
  const confirmClass = isDanger
    ? "bg-red-600 hover:bg-red-700"
    : "bg-[#F6490D] hover:bg-[#DC3F0A]";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#111827]/45 backdrop-blur-[3px] animate-in fade-in duration-200"
        onClick={() => !loading && onCancel?.()}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-description"
        className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.20)] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="p-7">
          <div className="flex items-start justify-between gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconClass}`}>
              <Icon size={27} strokeWidth={1.8} />
            </div>
            <button
              type="button"
              aria-label="Close confirmation"
              disabled={loading}
              onClick={onCancel}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <X size={19} />
            </button>
          </div>
          <h2 id="admin-confirm-title" className="mt-5 text-xl font-semibold tracking-tight text-[#111827]">
            {title}
          </h2>
          <p id="admin-confirm-description" className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-[#FAFAFA] px-7 py-5">
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}