export const RESET_SCOPE = { CYCLE: "cycle", ALL: "all" };

export const RESET_LABELS = {
  questionnaires: "Performance Questionnaires",
  questionnaire_items: "Performance Questionnaire Items",
  potential_assessments: "Potential Assessments",
  potential_questionnaire_items: "Potential Questionnaire Items",
  potential_questionnaire_customizations: "Potential Questionnaire Customizations",
  analytics_release_records: "Analytics Release Records",
  appraisal_records: "Appraisal Recommendations",
  nine_box_records: "9-Box Placements",
  potential_scores: "Potential Scores",
  performance_scores: "Performance Scores",
  ppi_records: "Past Performance Index Records",
  potential_descriptive_assessment_history: "Potential Descriptive Assessment History",
  potential_descriptive_scores: "Potential Descriptive Marks",
  potential_descriptive_assessments: "Potential Descriptive Preferences",
  potential_responses: "Potential Evaluation Responses",
  descriptive_assessment_history: "Performance Descriptive Assessment History",
  descriptive_question_ratings: "Performance Descriptive Question Ratings",
  descriptive_assessments: "Performance Descriptive Preferences",
  descriptive_scores: "Performance Descriptive Marks",
  questionnaire_responses: "Performance Evaluation Responses",
  stage_submissions: "Performance Stage Submissions",
  peer_assignments: "Peer Reviewer Assignments",
  questionnaires_reset: "Performance Questionnaires Reset",
  potential_assessments_reset: "Potential Assessments Reset",
  performance_descriptive_preferences_reset: "Performance Preferences Reset",
  potential_descriptive_preferences_reset: "Potential Preferences Reset"
};

export const DELETION_GROUPS = [
  {
    title: "Performance Evaluations",
    keys: ["questionnaire_responses", "stage_submissions", "peer_assignments"]
  },
  {
    title: "Potential Evaluations",
    keys: ["potential_responses"]
  },
  {
    title: "Performance Descriptive Scoring",
    keys: ["descriptive_scores", "descriptive_question_ratings", "descriptive_assessments", "descriptive_assessment_history"]
  },
  {
    title: "Potential Descriptive Scoring",
    keys: ["potential_descriptive_scores", "potential_descriptive_assessments", "potential_descriptive_assessment_history"]
  },
  {
    title: "Calculated Scores & Analytics",
    keys: ["performance_scores", "potential_scores", "ppi_records", "nine_box_records", "appraisal_records", "analytics_release_records"]
  }
];

export const PRESERVED_KEYS = [
  "questionnaires", "questionnaire_items", "potential_assessments",
  "potential_questionnaire_items", "potential_questionnaire_customizations"
];

export const RESET_KEYS = [
  "questionnaires_reset", "potential_assessments_reset",
  "performance_descriptive_preferences_reset", "potential_descriptive_preferences_reset"
];

export const PRESERVED_CONFIGURATION = [
  "Employee master records and manager mappings",
  "Performance and Potential Question Banks",
  "Questionnaire structures and question weightages",
  "Questionnaire customizations",
  "Questionnaire publication states",
  "Review cycles and global scoring configurations"
];

export function formatResetLabel(key) {
  return RESET_LABELS[key] || String(key).replaceAll("_", " ").replace(/\b\w/g, value => value.toUpperCase());
}

export function normalizeResetCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export function getResetScopeLabel(scope) {
  return scope === RESET_SCOPE.ALL ? "Full Employee PMS Reset" : "Cycle Reset";
}

export function buildResetSelection(employeeNumber, cycleId, scope) {
  const employee = String(employeeNumber ?? "").trim();
  if (!employee) throw new Error("Please enter employee number.");
  if (![RESET_SCOPE.CYCLE, RESET_SCOPE.ALL].includes(scope)) throw new Error("Invalid reset scope.");
  if (scope === RESET_SCOPE.CYCLE && !/^[1-9]\d*$/.test(String(cycleId ?? ""))) throw new Error("Please select a valid review cycle.");
  return {
    employee_number: employee,
    review_cycle_id: scope === RESET_SCOPE.CYCLE ? String(cycleId) : null,
    scope
  };
}

export function getResetSelectionKey(selection) {
  return JSON.stringify([
    String(selection?.employee_number ?? "").trim(),
    selection?.scope ?? "",
    selection?.scope === RESET_SCOPE.CYCLE ? String(selection?.review_cycle_id ?? "") : ""
  ]);
}

export function buildResetPreviewPath(selection) {
  const query = new URLSearchParams({
    employee_number: selection.employee_number,
    scope: selection.scope
  });
  if (selection.scope === RESET_SCOPE.CYCLE) query.set("review_cycle_id", selection.review_cycle_id);
  return `/api/admin/reset/preview?${query.toString()}`;
}

export function normalizeDeletionSummary(summary = {}) {
  const keys = DELETION_GROUPS.flatMap(group => group.keys);
  return Object.fromEntries(keys.map(key => [key, normalizeResetCount(summary?.[key])]));
}

export function normalizePreservedSummary(summary = {}) {
  return Object.fromEntries(PRESERVED_KEYS.map(key => [key, normalizeResetCount(summary?.[key])]));
}

export function normalizeResetSummary(summary = {}) {
  return Object.fromEntries(RESET_KEYS.map(key => [key, normalizeResetCount(summary?.[key])]));
}

export function normalizeResetPreview(data, selection) {
  if (!data || typeof data !== "object" || typeof data.safe_to_reset !== "boolean") {
    throw new Error("Invalid reset preview received from the server.");
  }
  if (String(data.employee?.employee_number ?? "") !== selection.employee_number) {
    throw new Error("Reset preview belongs to another employee.");
  }
  if (selection.scope === RESET_SCOPE.CYCLE && String(data.review_cycle?.id ?? "") !== selection.review_cycle_id) {
    throw new Error("Reset preview belongs to another review cycle.");
  }
  if (selection.scope === RESET_SCOPE.ALL && data.review_cycle != null) {
    throw new Error("Invalid reset scope received from the server.");
  }
  if (!data.delete_summary || !data.preserved_summary || !data.reset_summary) {
    throw new Error("Reset preview is missing required summary information.");
  }
  return {
    ...data,
    selection: { ...selection },
    selectionKey: getResetSelectionKey(selection),
    delete_summary: normalizeDeletionSummary(data.delete_summary),
    preserved_summary: normalizePreservedSummary(data.preserved_summary),
    reset_summary: normalizeResetSummary(data.reset_summary),
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : []
  };
}

export function normalizeResetExecution(data, selection) {
  if (!data || typeof data !== "object" || !data.deleted || !data.preserved || !data.reset_summary) {
    throw new Error("The server returned an incomplete reset result. Verify the current PMS state before attempting another reset.");
  }
  if (String(data.employee_number ?? "") !== selection.employee_number || data.scope !== selection.scope) {
    throw new Error("Reset response does not match the requested employee and scope.");
  }
  if (selection.scope === RESET_SCOPE.CYCLE && String(data.review_cycle_id) !== selection.review_cycle_id) {
    throw new Error("Reset response does not match the requested review cycle.");
  }
  return {
    ...data,
    selection: { ...selection },
    deleted: normalizeDeletionSummary(data.deleted),
    preserved: normalizePreservedSummary(data.preserved),
    reset_summary: normalizeResetSummary(data.reset_summary),
    descriptive_preferences: {
      performance_enabled: data.descriptive_preferences?.performance_enabled,
      potential_enabled: data.descriptive_preferences?.potential_enabled
    },
    later_review_cycles_requiring_verification: Array.isArray(data.later_review_cycles_requiring_verification)
      ? data.later_review_cycles_requiring_verification : []
  };
}

export function getTotalDeletedRecords(summary) {
  return Object.values(normalizeDeletionSummary(summary)).reduce((total, count) => total + count, 0);
}

export function getResetConfirmationDescription(preview) {
  const selection = preview.selection;
  const scope = selection.scope === RESET_SCOPE.ALL
    ? "ALL review cycles"
    : `Review cycle: ${preview.review_cycle?.name || selection.review_cycle_id}`;
  return [
    `Employee: ${preview.employee?.full_name || "—"} (${selection.employee_number})`,
    scope,
    `${getTotalDeletedRecords(preview.delete_summary)} transaction records are currently identified for deletion.`,
    `${preview.reset_summary.questionnaires_reset} Performance questionnaire(s) and ${preview.reset_summary.potential_assessments_reset} Potential assessment(s) will be reset.`,
    "Both descriptive scoring preferences will return to OFF.",
    "Questionnaire structures, publication states and question-bank configurations will be preserved.",
    "This action cannot be undone."
  ].join("\n\n");
}

export async function synchronizePMSResetCache(queryClient) {
  await queryClient.cancelQueries();
  await queryClient.invalidateQueries({ refetchType: "none" });
  queryClient.removeQueries({ type: "inactive" });
  await queryClient.refetchQueries({ type: "active" }, { cancelRefetch: true, throwOnError: true });
}