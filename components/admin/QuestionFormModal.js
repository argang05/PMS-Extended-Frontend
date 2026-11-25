"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_FORM = {
  question_text: "", category_id: "", department: "", default_weightage: "1",
  is_active: true, question_type: "objective", max_marks: "10",
  target_mode: "manual", departments: [], employee_ids: [], excluded_employee_ids: []
};

const inputClass = "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#F6490D]";
const primaryClass = "rounded-xl bg-[#F6490D] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50";
const secondaryClass = "rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium disabled:opacity-50";

const TARGET_MODES = [
  { value: "manual", label: "Question Bank Only (Assign Later)" },
  { value: "all", label: "All Employees" },
  { value: "departments", label: "Selected Departments" },
  { value: "employees", label: "Selected Employees" },
  { value: "combined", label: "Selected Departments OR Employees" },
  { value: "legacy", label: "Legacy Department Targeting" }
];

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const value = Object.values(data).find(Boolean);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "string") return value;
  }
  return fallback;
}

export default function QuestionFormModal({
  open, mode = "create", categories = [], initialData = null,
  saving = false, onClose, onSubmit, accessToken
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [options, setOptions] = useState({ departments: [], employees: [] });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = initialData;
    setForm(q ? {
      question_text: q.question_text || "",
      category_id: String(q.category?.id ?? q.category_id ?? ""),
      department: q.department || "",
      default_weightage: String(q.default_weightage ?? 1),
      is_active: q.is_active !== false,
      question_type: q.question_type || "objective",
      max_marks: String(q.max_marks ?? 10),
      target_mode: q.target_mode || "legacy",
      departments: q.departments || [],
      employee_ids: q.employee_ids || [],
      excluded_employee_ids: q.excluded_employee_ids || []
    } : { ...DEFAULT_FORM, departments: [], employee_ids: [], excluded_employee_ids: [] });
    setSearch("");
    setDebouncedSearch("");
    setPreview(null);
  }, [open, initialData]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!open || !accessToken) return;
    let active = true;
    const controller = new AbortController();

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/admin/questions/targeting-options?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store", signal: controller.signal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getError(data, "Failed to load targeting options."));
        if (active) setOptions({
          departments: Array.isArray(data.departments) ? data.departments : [],
          employees: Array.isArray(data.employees) ? data.employees : []
        });
      } catch (error) {
        if (active && error.name !== "AbortError") toast.error(error.message);
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    loadOptions();
    return () => { active = false; controller.abort(); };
  }, [open, accessToken, debouncedSearch]);

  function update(key, value) {
    setForm(previous => ({ ...previous, [key]: value }));
    setPreview(null);
  }

  function toggle(key, value) {
    setForm(previous => ({
      ...previous,
      [key]: previous[key].includes(value)
        ? previous[key].filter(item => item !== value)
        : [...previous[key], value]
    }));
    setPreview(null);
  }

  const payload = useMemo(() => {
    const targetMode = form.target_mode;
    return {
      question_text: form.question_text.trim(),
      category_id: form.category_id === "" ? null : Number(form.category_id),
      department: targetMode === "legacy" ? form.department.trim() || null : null,
      default_weightage: Number(form.default_weightage),
      is_active: form.is_active,
      question_type: form.question_type,
      max_marks: Number(form.max_marks),
      target_mode: targetMode,
      departments: ["departments", "combined"].includes(targetMode) ? form.departments : [],
      employee_ids: ["employees", "combined"].includes(targetMode) ? form.employee_ids : [],
      excluded_employee_ids: ["all", "departments", "employees", "combined"].includes(targetMode)
        ? form.excluded_employee_ids : []
    };
  }, [form]);

  const showDepartments = ["departments", "combined"].includes(form.target_mode);
  const showEmployees = ["employees", "combined"].includes(form.target_mode);
  const showExclusions = !["legacy", "manual"].includes(form.target_mode);

  function validate() {
    if (!payload.question_text) return "Question text is required.";
    if (payload.category_id !== null && (!Number.isInteger(payload.category_id) || payload.category_id <= 0 || !categories.some(c => Number(c.id) === payload.category_id))) {
      return "Select a valid category.";
    }
    if (payload.category_id === null && form.target_mode !== "manual") {
      return "Assign a question category before enabling employee targeting.";
    }
    if (!Number.isFinite(payload.default_weightage) || payload.default_weightage <= 0) return "Weightage must be greater than zero.";
    if (!Number.isInteger(payload.max_marks) || payload.max_marks < 1) return "Maximum marks must be a positive integer.";
    if (form.target_mode === "departments" && !payload.departments.length) return "Select at least one department.";
    if (form.target_mode === "employees" && !payload.employee_ids.length) return "Select at least one employee.";
    if (form.target_mode === "combined" && !payload.departments.length && !payload.employee_ids.length) return "Select at least one department or employee.";
    return null;
  }

  async function handlePreview() {
    const error = validate();
    if (error) return toast.error(error);
    try {
      setPreviewing(true);
      const res = await fetch("/api/admin/questions/targeting-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          ...(initialData?.id ? { question_id: initialData.id } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getError(data, "Unable to preview targeting."));
      setPreview(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPreviewing(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const error = validate();
    if (error) return toast.error(error);
    onSubmit(payload);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#111827]">
              {mode === "edit" ? "Edit Question" : "Add New Question"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure question details, scoring and employee targeting.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryClass}>Close</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold">Question Text</label>
            <textarea required rows={3} value={form.question_text}
              onChange={e => update("question_text", e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="Enter the evaluation question"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Question Category</label>
              <select value={form.category_id}
                onChange={e => update("category_id", e.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="">Uncategorised — Configure Later</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.category_type})
                  </option>
                ))}
              </select>
              {form.category_id === "" && (
                <p className="mt-2 text-xs text-amber-700">
                  This question will remain in the Question Bank until categorised.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold">Default Weightage</label>
              <input required type="number" min="0.01" step="any"
                value={form.default_weightage}
                onChange={e => update("default_weightage", e.target.value)}
                className={`${inputClass} mt-2`}
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Question Type</label>
              <select value={form.question_type}
                onChange={e => update("question_type", e.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="objective">Objective — Numerical Score</option>
                <option value="descriptive">Descriptive — Written Answer</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold">Maximum Marks</label>
              <input required type="number" min="1" step="1"
                value={form.max_marks}
                onChange={e => update("max_marks", e.target.value)}
                className={`${inputClass} mt-2`}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">Employee Targeting Mode</label>
            <select value={form.target_mode}
              onChange={e => update("target_mode", e.target.value)}
              className={`${inputClass} mt-2`}
            >
              {TARGET_MODES.map(item => (
                <option key={item.value} value={item.value}
                  disabled={form.category_id === "" && item.value !== "manual"}
                >
                  {item.label}
                </option>
              ))}
            </select>

            {form.target_mode === "manual" ? (
              <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-[#C2410C]">
                This question will be saved in the Question Bank without automatic employee assignment.
                You can manually include it in an employee questionnaire after assigning a category,
                or change its targeting mode later.
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                Combined targeting includes employees matching any selected department or individually selected employee.
              </p>
            )}
          </div>

          {form.target_mode === "legacy" && (
            <div>
              <label className="text-sm font-semibold">Legacy Department</label>
              <input value={form.department}
                onChange={e => update("department", e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Leave blank for common behavioral questions"
              />
            </div>
          )}

          {showDepartments && (
            <fieldset className="rounded-2xl border border-gray-200 p-4">
              <legend className="px-2 text-sm font-semibold">
                Target Departments ({form.departments.length})
              </legend>
              <div className="grid max-h-44 gap-3 overflow-y-auto sm:grid-cols-2">
                {options.departments.map(department => (
                  <label key={department} className="flex items-center gap-2 text-sm">
                    <input type="checkbox"
                      checked={form.departments.includes(department)}
                      onChange={() => toggle("departments", department)}
                    />
                    {department}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {(showEmployees || showExclusions) && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Search Employees</label>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="Search by employee name, employee number, or department"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Search is case-insensitive. Up to 100 employees are returned per search.
                  Selected employees remain selected when searching again.
                </p>
              </div>

              {loadingOptions && <p className="text-sm text-gray-500">Searching employees...</p>}

              {!loadingOptions && options.employees.length === 0 && (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  No employees found. Try searching by name, employee number, or department.
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {showEmployees && (
                  <fieldset className="rounded-2xl border border-gray-200 p-4">
                    <legend className="px-2 text-sm font-semibold">
                      Include Employees ({form.employee_ids.length})
                    </legend>
                    <div className="max-h-48 space-y-3 overflow-y-auto">
                      {options.employees.map(employee => (
                        <label key={employee.id} className="flex items-start gap-2 text-xs">
                          <input type="checkbox"
                            checked={form.employee_ids.includes(employee.id)}
                            onChange={() => toggle("employee_ids", employee.id)}
                          />
                          <span>
                            {employee.full_name}
                            <span className="block text-gray-500">
                              {employee.employee_number} — {employee.department || "No department"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {showExclusions && (
                  <fieldset className="rounded-2xl border border-gray-200 p-4">
                    <legend className="px-2 text-sm font-semibold">
                      Exclude Employees ({form.excluded_employee_ids.length})
                    </legend>
                    <div className="max-h-48 space-y-3 overflow-y-auto">
                      {options.employees.map(employee => (
                        <label key={employee.id} className="flex items-start gap-2 text-xs">
                          <input type="checkbox"
                            checked={form.excluded_employee_ids.includes(employee.id)}
                            onChange={() => toggle("excluded_employee_ids", employee.id)}
                          />
                          <span>
                            {employee.full_name}
                            <span className="block text-gray-500">
                              {employee.employee_number} — {employee.department || "No department"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <input type="checkbox" checked={form.is_active}
              onChange={e => update("is_active", e.target.checked)}
            />
            Keep this question active
          </label>

          {preview && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <h3 className="font-semibold text-[#111827]">
                Targeting Preview — {preview.total_employees} Employees
              </h3>
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {preview.employees?.map(employee => (
                  <p key={employee.id} className="text-xs text-gray-700">
                    {employee.full_name} ({employee.employee_number}) — {employee.department || "N/A"}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t pt-5">
            <button type="button" onClick={handlePreview}
              disabled={saving || previewing} className={secondaryClass}
            >
              {previewing ? "Loading Preview..." : "Preview Targeting"}
            </button>
            <button type="submit" disabled={saving} className={primaryClass}>
              {saving ? "Saving..." : mode === "edit" ? "Update Question" : "Create Question"}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className={secondaryClass}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}