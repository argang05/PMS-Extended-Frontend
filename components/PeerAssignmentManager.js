"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F6490D] focus:ring-2 focus:ring-[#F6490D]/10 disabled:bg-gray-50";
const primaryClass = "rounded-xl bg-[#F6490D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#E44109] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const entry = Object.entries(data).find(([key, value]) => value && key !== "results");
    if (entry) return `${entry[0]}: ${Array.isArray(entry[1]) ? entry[1].join(", ") : JSON.stringify(entry[1])}`;
  }
  return fallback;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function ConfirmModal({ action, busy, onCancel, onConfirm }) {
  useEffect(() => {
    if (!action) return;
    const handleEscape = event => { if (event.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleEscape); document.body.style.overflow = previousOverflow; };
  }, [action, busy, onCancel]);

  if (!action) return null;
  const removing = action.type === "remove";
  const peer = action.peer;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div role="dialog" aria-modal="true" aria-labelledby="peer-confirm-title" className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className={`h-1.5 w-full ${removing ? "bg-red-500" : "bg-[#F6490D]"}`} />
        <div className="p-6 sm:p-7">
          <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${removing ? "bg-red-50 text-red-600" : "bg-[#FFF1EC] text-[#F6490D]"}`}>
            {removing ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M19 8v8m-4-4h8" />
              </svg>
            )}
          </div>

          <h2 id="peer-confirm-title" className="text-xl font-semibold tracking-tight text-[#111827]">
            {removing ? "Remove Peer Reviewer?" : "Confirm Peer Assignment"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {removing
              ? "Are you sure you want to remove this employee from your peer review assignments?"
              : "Please confirm that you want to assign this employee to independently review your performance questionnaire."}
          </p>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#FCFCFD] p-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${removing ? "bg-red-50 text-red-600" : "bg-[#FFF1EC] text-[#F6490D]"}`}>
              {peer.full_name?.split(" ").slice(0, 2).map(name => name[0]).join("").toUpperCase() || "PR"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{peer.full_name}</p>
              <p className="mt-1 text-xs text-gray-500">{peer.employee_number} · {peer.department || "No department"}</p>
            </div>
          </div>

          <div className={`mt-4 rounded-xl px-4 py-3 text-xs leading-5 ${removing ? "border border-red-100 bg-red-50 text-red-700" : "border border-orange-100 bg-[#FFF7F4] text-[#B93808]"}`}>
            {removing
              ? "This reviewer will be removed from your current questionnaire."
              : "The selected employee will receive a peer review assignment for your questionnaire."}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={busy} className={`${secondaryClass} sm:min-w-28`}>Cancel</button>
            <button type="button" onClick={onConfirm} disabled={busy}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${removing ? "bg-red-600 hover:bg-red-700" : "bg-[#F6490D] hover:bg-[#E44109]"}`}>
              {busy ? "Processing..." : removing ? "Confirm Removal" : "Confirm Assignment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ completed }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      <span className={`h-2 w-2 rounded-full ${completed ? "bg-emerald-500" : "bg-amber-500"}`} />
      {completed ? "Completed" : "Pending"}
    </span>
  );
}

function SearchReviewer({ slot, accessToken, busy, assignedPeers, onAssign }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    if (!accessToken || query.trim().length < 2 || selectedPeer) {
      setResults([]);
      setSearching(false);
      return;
    }
    const currentSequence = ++sequence.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await fetch(`/api/evaluations/peer/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal, cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(getError(data, "Employee search failed."));
        if (currentSequence === sequence.current) {
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        }
      } catch (error) {
        if (error.name !== "AbortError" && currentSequence === sequence.current) {
          toast.error(error.message);
          setResults([]);
        }
      } finally {
        if (currentSequence === sequence.current) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
      sequence.current++;
    };
  }, [query, accessToken, selectedPeer]);

  function selectEmployee(employee) {
    setSelectedPeer(employee);
    setQuery(`${employee.full_name} (${employee.employee_number})`);
    setResults([]);
    setOpen(false);
  }

  function clearSelection() {
    setSelectedPeer(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  async function handleAssign() {
    if (!selectedPeer || busy) return;
    const success = await onAssign(selectedPeer);
    if (success) clearSelection();
  }

  const alreadyAssigned = selectedPeer && assignedPeers.some(peer => String(peer.peer_id) === String(selectedPeer.id));

  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 transition hover:border-[#F6490D]/40">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1EC] text-sm font-bold text-[#F6490D]">{slot}</div>
          <div>
            <h4 className="text-sm font-semibold text-[#111827]">Peer Reviewer {slot}</h4>
            <p className="mt-1 text-xs text-gray-500">Select an employee to assign</p>
          </div>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">Available</span>
      </div>

      <div className="relative">
        <input type="text" value={query} onChange={event => { setQuery(event.target.value); setSelectedPeer(null); setOpen(true); }}
          onFocus={() => { if (results.length) setOpen(true); }} placeholder="Search name or employee number..."
          className={inputClass} disabled={busy} autoComplete="off" />
        {searching && <p className="mt-2 text-xs text-gray-500">Searching employees...</p>}
        {open && results.length > 0 && !selectedPeer && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
            {results.map(employee => {
              const assigned = assignedPeers.some(peer => String(peer.peer_id) === String(employee.id));
              return (
                <button key={employee.id} type="button" disabled={assigned} onClick={() => selectEmployee(employee)}
                  className="block w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-0 hover:bg-[#FFF7F4] disabled:cursor-not-allowed disabled:opacity-40">
                  <p className="text-sm font-semibold text-[#111827]">{employee.full_name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {employee.employee_number} · {employee.department || "No department"}{assigned ? " · Already assigned" : ""}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedPeer && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#F6490D]/20 bg-[#FFF7F4] px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#111827]">{selectedPeer.full_name}</p>
            <p className="mt-1 text-xs text-gray-500">{selectedPeer.employee_number}</p>
          </div>
          <button type="button" onClick={clearSelection} disabled={busy} className="text-xs font-medium text-[#F6490D] hover:underline">Change</button>
        </div>
      )}

      <button type="button" onClick={handleAssign} disabled={!selectedPeer || alreadyAssigned || busy} className={`${primaryClass} mt-4 w-full`}>
        {busy ? "Processing..." : `Assign Reviewer ${slot}`}
      </button>
    </div>
  );
}

function AssignedReviewer({ slot, peer, busy, removable, onRemove }) {
  const completed = peer.status === "completed";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700">{slot}</div>
          <div>
            <h4 className="text-sm font-semibold text-[#111827]">Peer Reviewer {slot}</h4>
            <p className="mt-1 text-xs text-gray-500">Assigned reviewer</p>
          </div>
        </div>
        <StatusBadge completed={completed} />
      </div>

      <div className="rounded-xl bg-[#F9FAFB] p-4">
        <p className="text-sm font-semibold text-[#111827]">{peer.full_name}</p>
        <p className="mt-2 text-xs text-gray-600">Employee No: {peer.employee_number}</p>
        <p className="mt-1 text-xs text-gray-600">Department: {peer.department || "—"}</p>
        <p className="mt-1 text-xs text-gray-600">Assigned: {formatDate(peer.assigned_at)}</p>
      </div>

      {completed ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
          Evaluation submitted successfully.
        </div>
      ) : removable ? (
        <button type="button" onClick={() => onRemove(peer)} disabled={busy}
          className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Processing..." : "Remove Reviewer"}
        </button>
      ) : (
        <p className="mt-4 text-xs text-gray-500">{busy ? "Please wait..." : "At least one reviewer must remain assigned."}</p>
      )}
    </div>
  );
}

export default function PeerAssignmentManager({ questionnaireId, accessToken, onUpdate }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const closeConfirm = useCallback(() => { if (!busy) setConfirmAction(null); }, [busy]);

  const api = useCallback(async (path, method = "GET", payload) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const options = { method, headers, cache: "no-store" };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(path, options);
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error("Invalid server response."); }
    if (!response.ok) throw new Error(getError(data, `Request failed (${response.status}).`));
    return data;
  }, [accessToken]);

  const loadProgress = useCallback(async () => {
    if (!questionnaireId || !accessToken) return;
    try {
      setLoading(true);
      setError("");
      const data = await api(`/api/evaluations/peer/assignments/${questionnaireId}`);
      setProgress(data.peer_review || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [questionnaireId, accessToken, api]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const peers = progress?.peers || [];
  const assigned = progress?.assigned ?? peers.length;
  const completed = progress?.completed ?? peers.filter(peer => peer.status === "completed").length;
  const pending = progress?.pending ?? Math.max(assigned - completed, 0);
  const allCompleted = Boolean(progress?.all_completed);
  const canAdd = assigned < 3;

  function addPeer(employee) {
    if (!employee || !canAdd || busy) return false;
    if (peers.some(peer => String(peer.peer_id) === String(employee.id))) {
      toast.error("This employee is already assigned as a peer reviewer.");
      return false;
    }
    setConfirmAction({ type: "add", peer: employee });
    return false;
  }

  function removePeer(peer) {
    if (busy || allCompleted || peer.status === "completed" || assigned <= 1) return;
    setConfirmAction({ type: "remove", peer });
  }

  async function confirmPeerAction() {
    if (!confirmAction || busy) return;
    const { type, peer } = confirmAction;
    if (type === "add" && (!canAdd || peers.some(item => String(item.peer_id) === String(peer.id)))) {
      toast.error("This reviewer cannot be assigned.");
      setConfirmAction(null);
      return;
    }
    if (type === "remove" && (allCompleted || peer.status === "completed" || assigned <= 1)) {
      toast.error("This reviewer cannot be removed.");
      setConfirmAction(null);
      return;
    }

    try {
      setBusy(true);
      const data = type === "add"
        ? await api(`/api/evaluations/peer/assignments/${questionnaireId}/add`, "POST", { peer_id: peer.id })
        : await api(`/api/evaluations/peer/assignments/${questionnaireId}/remove/${peer.peer_id}`, "DELETE");
      toast.success(data.message || (type === "add" ? "Peer reviewer assigned successfully." : "Peer reviewer removed successfully."));
      setConfirmAction(null);
      await loadProgress();
      if (onUpdate) await onUpdate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!questionnaireId) return null;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#111827]">Peer Review Assignments</h3>
          <p className="mt-1 text-sm text-gray-600">Assign up to three employees to independently review your questionnaire.</p>
        </div>
        <button type="button" onClick={loadProgress} disabled={loading || busy} className={secondaryClass}>Refresh</button>
      </div>

      {loading ? (
        <div className="mt-6 rounded-xl bg-white p-5 text-sm text-gray-500">Loading peer assignments...</div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={loadProgress} className={`${secondaryClass} mt-3`}>Retry</button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Assigned", value: assigned, description: "Out of 3 reviewers" },
              { label: "Completed", value: completed, description: "Reviews submitted" },
              { label: "Pending", value: pending, description: "Awaiting review" }
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#111827]">{item.value}</p>
                <p className="mt-1 text-xs text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-[#111827]">Your Peer Reviewers</h4>
              <span className="rounded-full bg-[#FFF1EC] px-3 py-1.5 text-xs font-semibold text-[#F6490D]">{assigned} / 3 Assigned</span>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-[#F6490D] transition-all duration-300" style={{ width: `${Math.min((assigned / 3) * 100, 100)}%` }} />
            </div>

            {allCompleted && assigned > 0 && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                All currently assigned peer reviewers have completed their evaluations.
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => {
                const slot = index + 1;
                const peer = peers[index];
                if (peer) {
                  const removable = !busy && !allCompleted && peer.status !== "completed" && assigned > 1;
                  return <AssignedReviewer key={peer.assignment_id ?? peer.peer_id} slot={slot} peer={peer} busy={busy} removable={removable} onRemove={removePeer} />;
                }
                return <SearchReviewer key={`empty-${slot}`} slot={slot} accessToken={accessToken} busy={busy} assignedPeers={peers} onAssign={addPeer} />;
              })}
            </div>
          </div>

          {assigned === 3 && (
            <div className="mt-5 rounded-xl border border-[#F6490D]/20 bg-[#FFF7F4] px-4 py-3 text-sm text-[#B93808]">
              All three peer reviewer slots have been filled.
            </div>
          )}

          {assigned === 0 && (
            <p className="mt-5 text-xs text-gray-500">
              Start by searching for an employee in any reviewer slot. You can assign up to three different employees.
            </p>
          )}
        </>
      )}

      <ConfirmModal action={confirmAction} busy={busy} onCancel={closeConfirm} onConfirm={confirmPeerAction} />
    </div>
  );
}