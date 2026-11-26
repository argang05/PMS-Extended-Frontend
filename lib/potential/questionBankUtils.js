export const ALL_TARGET_MODES = "__all__";

export const TARGET_MODES = [
  { value: "manual", label: "Question Bank Only / Assign Later" },
  { value: "all", label: "All Employees" },
  { value: "departments", label: "Selected Departments" },
  { value: "employees", label: "Selected Employees" },
  { value: "combined", label: "Departments + Employees" }
];

export const QUESTION_TYPES = [
  { value: "objective", label: "Objective" },
  { value: "descriptive", label: "Descriptive" }
];

export function emptyPotentialQuestion() {
  return {
    question_text: "", question_type: "objective", weightage: 1,
    max_marks: 10, target_mode: "manual", departments: [],
    employee_ids: [], excluded_employee_ids: [], is_active: true
  };
}

function uniqueIds(values = []) {
  return [...new Set(values.map(value => Number(value?.id ?? value)))].filter(value => Number.isInteger(value) && value > 0);
}

function uniqueDepartments(values = []) {
  return [...new Set(values.map(value => String(value?.name ?? value).trim()).filter(Boolean))];
}

export function questionToForm(question) {
  return {
    question_text: question.question_text || "",
    question_type: question.question_type || "objective",
    weightage: question.weightage ?? question.default_weightage ?? 1,
    max_marks: question.max_marks ?? 10,
    target_mode: question.target_mode || "manual",
    departments: uniqueDepartments(question.departments || []),
    employee_ids: uniqueIds(question.employee_ids || []),
    excluded_employee_ids: uniqueIds(question.excluded_employee_ids || []),
    is_active: question.is_active !== false
  };
}

export function validatePotentialQuestion(form, { allowLegacy = false } = {}) {
  const errors = {};
  const text = String(form.question_text || "").trim();
  const weightage = Number(form.weightage);
  const maximum = Number(form.max_marks);
  const mode = form.target_mode || "manual";
  if (!text) errors.question_text = "Question text is required.";
  if (!QUESTION_TYPES.some(type => type.value === form.question_type)) errors.question_type = "Select a valid question type.";
  if (!Number.isFinite(weightage) || weightage <= 0) errors.weightage = "Weightage must be greater than zero.";
  if (!Number.isInteger(maximum) || maximum < 1) errors.max_marks = "Maximum marks must be a positive integer.";
  if (form.question_type === "descriptive" && maximum !== 10 && !allowLegacy) errors.max_marks = "Descriptive questions must use a maximum of 10 marks.";
  if (!TARGET_MODES.some(target => target.value === mode) && !(allowLegacy && mode === "legacy")) errors.target_mode = "Select a valid targeting mode.";
  if (mode === "departments" && !form.departments?.length) errors.departments = "Select at least one department.";
  if (mode === "employees" && !form.employee_ids?.length) errors.employee_ids = "Select at least one employee.";
  if (mode === "combined" && (!form.departments?.length || !form.employee_ids?.length)) errors.target_mode = "Select both departments and employees.";
  return errors;
}

export function buildTargetingPayload(form) {
  const mode = form.target_mode || "manual";
  return {
    target_mode: mode,
    departments: ["departments", "combined"].includes(mode) ? uniqueDepartments(form.departments) : [],
    employee_ids: ["employees", "combined"].includes(mode) ? uniqueIds(form.employee_ids) : [],
    excluded_employee_ids: ["manual", "legacy"].includes(mode) ? [] : uniqueIds(form.excluded_employee_ids)
  };
}

export function buildPotentialQuestionPayload(form) {
  const targeting = form.target_mode === "legacy" ? { target_mode: "legacy" } : buildTargetingPayload(form);
  return {
    question_text: String(form.question_text || "").trim(),
    question_type: form.question_type,
    weightage: Number(form.weightage),
    max_marks: Number(form.max_marks),
    is_active: Boolean(form.is_active),
    ...targeting
  };
}

export function getTargetModeLabel(mode) {
  if (mode === "legacy") return "Legacy Assignment";
  return TARGET_MODES.find(item => item.value === mode)?.label || "Unconfigured";
}

export function parsePotentialBulkQuestions(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw).replace(/^\uFEFF/, "").trim());
  } catch {
    throw new Error("Invalid JSON. Provide a valid JSON array of question strings.");
  }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error("Provide a non-empty JSON array of question strings.");
  if (parsed.length > 500) throw new Error("A maximum of 500 questions can be created in one request.");
  const seen = new Map();
  return parsed.map((question, index) => {
    if (typeof question !== "string") throw new Error(`Question ${index + 1}: Expected a string.`);
    const text = question.trim();
    if (!text) throw new Error(`Question ${index + 1}: Question text cannot be empty.`);
    const normalized = text.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(normalized)) throw new Error(`Question ${index + 1} duplicates question ${seen.get(normalized)}.`);
    seen.set(normalized, index + 1);
    return buildPotentialQuestionPayload({ ...emptyPotentialQuestion(), question_text: text });
  });
}

export function filterPotentialQuestions(questions, filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  return questions.filter(question => {
    if (search) {
      const searchable = [
        question.question_text, question.question_type,
        getTargetModeLabel(question.target_mode),
        ...(question.departments || []).map(department => department?.name ?? department)
      ].join(" ").toLowerCase();
      if (!searchable.includes(search)) return false;
    }
    if (filters.questionType && filters.questionType !== "all" && question.question_type !== filters.questionType) return false;
    if (filters.targetMode && filters.targetMode !== ALL_TARGET_MODES && question.target_mode !== filters.targetMode) return false;
    if (filters.status === "active" && !question.is_active) return false;
    if (filters.status === "inactive" && question.is_active) return false;
    if (filters.configuration === "configured" && !question.is_configured) return false;
    if (filters.configuration === "unconfigured" && question.is_configured) return false;
    return true;
  });
}

export const POTENTIAL_BULK_EXAMPLE = JSON.stringify([
  "Demonstrates the ability to take ownership of complex responsibilities.",
  "Shows the ability to adapt to changing business requirements.",
  "Describe the employee's readiness to undertake higher-level responsibilities.",
  "Exhibits the ability to make effective strategic decisions."
], null, 2);