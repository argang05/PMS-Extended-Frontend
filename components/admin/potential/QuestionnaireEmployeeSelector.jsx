"use client";

import { useMemo, useState } from "react";
import { Search, Users, CalendarDays, Plus, Loader2, LockKeyhole, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getQuestionnaireStatus } from "@/lib/potential/questionnaireUtils";

export default function QuestionnaireEmployeeSelector({
  employees = [], cycles = [], questionnaires = [], employeeId, cycleId,
  selectedId, onEmployeeChange, onCycleChange, onSelect, onCreate,
  loading = false, creating = false, disabled = false
}) {
  const [search, setSearch] = useState("");
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter(employee => [
      employee.full_name, employee.first_name, employee.last_name,
      employee.employee_number, employee.department, employee.designation
    ].join(" ").toLowerCase().includes(term));
  }, [employees, search]);

  const matching = useMemo(() => questionnaires.filter(questionnaire => {
    const employee = questionnaire.employee?.id ?? questionnaire.employee_id ?? questionnaire.employee;
    const cycle = questionnaire.review_cycle?.id ?? questionnaire.review_cycle_id ?? questionnaire.review_cycle;
    return (!employeeId || String(employee) === String(employeeId)) &&
      (!cycleId || String(cycle) === String(cycleId));
  }), [questionnaires, employeeId, cycleId]);

  const selectedEmployee = employees.find(employee => String(employee.id) === String(employeeId));

  return (
    <section className="space-y-5 rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#FFF1EC] p-3"><Users className="h-5 w-5 text-[#F6490D]" /></div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Select Employee & Review Cycle</h2>
          <p className="text-xs text-gray-500">Manage the Potential questionnaire for a specific employee.</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Employee</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input className="rounded-xl pl-9" value={search} disabled={disabled} placeholder="Search employee name, number or department..." onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border p-2">
            {filteredEmployees.map(employee => {
              const active = String(employee.id) === String(employeeId);
              return (
                <button type="button" key={employee.id} disabled={disabled} onClick={() => onEmployeeChange(employee.id)} className={`flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-all ${active ? "bg-[#FFF1EC] text-[#F6490D]" : "hover:bg-gray-50"}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`}</p>
                    <p className="truncate text-xs text-gray-500">{employee.employee_number} · {employee.department || "No department"}</p>
                  </div>
                  {active && <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
            {!filteredEmployees.length && <p className="p-4 text-center text-sm text-gray-500">No matching employees.</p>}
          </div>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><CalendarDays className="h-4 w-4" />Review Cycle</label>
          <select className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-[#F6490D]" value={cycleId || ""} disabled={disabled} onChange={event => onCycleChange(event.target.value)}>
            <option value="">Select review cycle</option>
            {cycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.is_active ? " — Active" : ""}</option>)}
          </select>
          {selectedEmployee && (
            <div className="space-y-2 rounded-xl border bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Selected Employee</p>
              <p className="font-semibold text-gray-900">{selectedEmployee.full_name || `${selectedEmployee.first_name || ""} ${selectedEmployee.last_name || ""}`}</p>
              <p className="text-xs text-gray-500">{selectedEmployee.employee_number} · {selectedEmployee.department}</p>
              <p className="text-xs text-gray-500">{selectedEmployee.designation}</p>
            </div>
          )}
          <Button className="w-full bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={disabled || creating || loading || !employeeId || !cycleId || matching.length > 0} onClick={() => onCreate({ employee_id: Number(employeeId), review_cycle_id: Number(cycleId) })}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {matching.length ? "Questionnaire Already Exists" : "Create Potential Questionnaire"}
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading questionnaires...</div>
      ) : matching.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700">Existing Potential Questionnaires</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {matching.map(questionnaire => {
              const status = getQuestionnaireStatus(questionnaire.status);
              const active = String(questionnaire.id) === String(selectedId);
              return (
                <button key={questionnaire.id} type="button" disabled={disabled} onClick={() => onSelect(questionnaire.id)} className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${active ? "border-[#F6490D]/50 bg-[#FFF1EC]/50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{questionnaire.employee?.full_name || questionnaire.employee_name || "Employee"} · {questionnaire.review_cycle?.name || questionnaire.review_cycle_name || "Review Cycle"}</p>
                    <p className="mt-1 text-xs text-gray-500">Assessment #{questionnaire.id} · {questionnaire.question_count ?? questionnaire.items_count ?? questionnaire.total_questions ?? "—"} questions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${status.className} border-0`}>{status.label}</Badge>
                    {questionnaire.is_published && <LockKeyhole className="h-4 w-4 text-amber-600" />}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}