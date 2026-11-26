"use client";

import { useMemo, useState } from "react";
import { Search, Users, Building2, UserMinus, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TARGET_MODES, buildTargetingPayload } from "@/lib/potential/questionBankUtils";

function EmployeeSelector({ employees = [], selected = [], onChange, disabled, title, icon: Icon }) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected.map(Number)), [selected]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter(employee => [
      employee.full_name, employee.first_name, employee.last_name,
      employee.employee_number, employee.department, employee.designation
    ].join(" ").toLowerCase().includes(term));
  }, [employees, search]);
  const toggle = id => {
    const numericId = Number(id);
    onChange(selectedSet.has(numericId)
      ? selected.filter(value => Number(value) !== numericId)
      : [...selected, numericId]);
  };
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm">
          <Icon className="h-4 w-4 text-primary" />{title}
        </div>
        <Badge variant="secondary">{selected.length} selected</Badge>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, employee number or department..." value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || !filtered.length} onClick={() => onChange([...new Set([...selected.map(Number), ...filtered.map(employee => Number(employee.id))])])}>Select filtered</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || !selected.length} onClick={() => onChange([])}>Clear selection</Button>
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
        {filtered.map(employee => (
          <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/50">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedSet.has(Number(employee.id))} disabled={disabled} onChange={() => toggle(employee.id)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`}</p>
              <p className="truncate text-xs text-muted-foreground">{employee.employee_number} · {employee.department || "No department"}</p>
            </div>
          </label>
        ))}
        {!filtered.length && <p className="py-5 text-center text-sm text-muted-foreground">No matching employees.</p>}
      </div>
    </div>
  );
}

export default function TargetingSelector({ value, onChange, options, disabled = false, onPreview, previewLoading = false }) {
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const departments = (options?.departments || []).map(item => String(item?.name ?? item));
  const employees = options?.employees || [];
  const mode = value.target_mode || "manual";
  const update = changes => {
    setPreview(null);
    setPreviewError("");
    onChange({ ...value, ...changes });
  };
  const changeMode = target_mode => update({
    target_mode,
    departments: ["departments", "combined"].includes(target_mode) ? value.departments || [] : [],
    employee_ids: ["employees", "combined"].includes(target_mode) ? value.employee_ids || [] : [],
    excluded_employee_ids: target_mode === "manual" ? [] : value.excluded_employee_ids || []
  });
  const toggleDepartment = department => {
    const current = value.departments || [];
    update({ departments: current.includes(department) ? current.filter(item => item !== department) : [...current, department] });
  };
  const previewTargeting = async () => {
    setPreviewError("");
    try {
      setPreview(await onPreview(buildTargetingPayload(value)));
    } catch (error) {
      setPreviewError(error.message || "Unable to preview targeting.");
    }
  };
  const previewEmployees = preview?.employees || preview?.matched_employees || preview?.results || [];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Question targeting</label>
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={mode} disabled={disabled} onChange={event => changeMode(event.target.value)}>
          {mode === "legacy" && <option value="legacy">Legacy Assignment</option>}
          {TARGET_MODES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Targeting determines whose Potential questionnaire receives this question automatically.</p>
      </div>
      {mode === "manual" && (
        <Card className="border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          This question will remain in the Question Bank and can be manually assigned through the Potential Questionnaire Builder.
        </Card>
      )}
      {mode === "all" && <Card className="bg-primary/5 p-4 text-sm">Automatically include this question for all eligible employees, subject to exclusions.</Card>}
      {mode === "legacy" && <Card className="bg-muted/30 p-4 text-sm">Existing legacy targeting is retained until explicitly reconfigured.</Card>}
      {["departments", "combined"].includes(mode) && (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-primary" />Departments</div>
            <Badge variant="secondary">{value.departments?.length || 0} selected</Badge>
          </div>
          <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {departments.map(department => (
              <label key={department} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm hover:bg-muted/50">
                <input type="checkbox" className="h-4 w-4 accent-primary" disabled={disabled} checked={(value.departments || []).includes(department)} onChange={() => toggleDepartment(department)} />
                {department}
              </label>
            ))}
          </div>
          {!departments.length && <p className="text-sm text-muted-foreground">No departments available.</p>}
        </div>
      )}
      {["employees", "combined"].includes(mode) && (
        <EmployeeSelector title="Individual employees" icon={Users} employees={employees} selected={value.employee_ids || []} disabled={disabled} onChange={employee_ids => update({ employee_ids })} />
      )}
      {mode === "combined" && <p className="text-xs text-muted-foreground">Department and individual employee selections are combined. Duplicate employees are counted only once.</p>}
      {!["manual", "legacy"].includes(mode) && (
        <EmployeeSelector title="Exclude employees" icon={UserMinus} employees={employees} selected={value.excluded_employee_ids || []} disabled={disabled} onChange={excluded_employee_ids => update({ excluded_employee_ids })} />
      )}
      {!["manual", "legacy"].includes(mode) && onPreview && (
        <Button type="button" variant="outline" className="w-full" disabled={disabled || previewLoading} onClick={previewTargeting}>
          {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Preview targeted employees
        </Button>
      )}
      {previewError && <p className="text-sm text-destructive">{previewError}</p>}
      {preview && (
        <Card className="space-y-3 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{preview.total_count ?? preview.count ?? previewEmployees.length} targeted employees</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {previewEmployees.map(employee => (
              <div key={employee.id} className="flex justify-between gap-2 rounded-md bg-background/70 p-2 text-sm">
                <span>{employee.full_name || employee.employee_number}</span>
                <span className="text-xs text-muted-foreground">{employee.department}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}