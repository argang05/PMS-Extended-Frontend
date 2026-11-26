"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createQuestionnaireDraft, hasQuestionnaireChanges,
  includeQuestion, excludeQuestion, updateQuestionWeightage,
  resetQuestionWeightage, moveQuestion, getQuestionnaireStats,
  isQuestionnaireLocked, hasPendingCustomization
} from "@/lib/potential/questionnaireUtils";

export function usePotentialQuestionnaireDraft(questionnaire, selectedId = questionnaire?.id) {
  const [original, setOriginal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [serverConflict, setServerConflict] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const dirty = useMemo(() => hasQuestionnaireChanges(draft, original), [draft, original]);
  const locked = isQuestionnaireLocked(questionnaire);
  const hasPendingDraft = hasPendingCustomization(questionnaire);
  const isActive = Boolean(questionnaire?.is_published);

  const clearDraft = useCallback(() => {
    setOriginal(null);
    setDraft(null);
    setServerConflict(false);
    setRequiresReload(false);
  }, []);

  const acceptQuestionnaire = useCallback(data => {
    if (!data?.id) return;
    const next = createQuestionnaireDraft(data);
    setOriginal(next);
    setDraft(next);
    setServerConflict(false);
    setRequiresReload(false);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      if (original || draft) clearDraft();
      return;
    }
    if (!questionnaire?.id || Number(questionnaire.id) !== Number(selectedId)) {
      if (original && Number(original.questionnaireId) !== Number(selectedId)) clearDraft();
      return;
    }
    const revision = questionnaire.revision ?? questionnaire.updated_at;
    if (!original || Number(original.questionnaireId) !== Number(questionnaire.id)) {
      acceptQuestionnaire(questionnaire);
      return;
    }
    if (requiresReload || serverConflict) return;
    if (original.revision !== revision) {
      if (dirty) setServerConflict(true);
      else acceptQuestionnaire(questionnaire);
    }
  }, [
    questionnaire, selectedId, original, draft, dirty,
    requiresReload, serverConflict, acceptQuestionnaire, clearDraft
  ]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const editable = Boolean(
    draft && questionnaire?.id &&
    Number(draft.questionnaireId) === Number(questionnaire.id) &&
    Number(draft.questionnaireId) === Number(selectedId) &&
    !locked && !requiresReload && !serverConflict
  );

  const addQuestion = useCallback(question => {
    if (!editable || question.is_active === false) return;
    setDraft(previous => includeQuestion(previous, question));
  }, [editable]);

  const addQuestions = useCallback(questions => {
    if (!editable) return;
    setDraft(previous => questions.filter(question => question.is_active !== false)
      .reduce((current, question) => includeQuestion(current, question), previous));
  }, [editable]);

  const removeQuestion = useCallback(id => {
    if (!editable) return;
    setDraft(previous => excludeQuestion(previous, id));
  }, [editable]);

  const changeWeightage = useCallback((id, value) => {
    if (!editable) return;
    setDraft(previous => updateQuestionWeightage(previous, id, value));
  }, [editable]);

  const restoreWeightage = useCallback((id, availableQuestions) => {
    if (!editable) return;
    setDraft(previous => resetQuestionWeightage(previous, id, availableQuestions));
  }, [editable]);

  const reorder = useCallback((fromId, toId) => {
    if (!editable) return;
    setDraft(previous => ({
      ...previous,
      items: moveQuestion(previous.items, fromId, toId)
    }));
  }, [editable]);

  const discardChanges = useCallback(() => {
    if (requiresReload || serverConflict || !questionnaire?.id) return false;
    acceptQuestionnaire(questionnaire);
    return true;
  }, [questionnaire, requiresReload, serverConflict, acceptQuestionnaire]);

  const acceptMutation = useCallback(result => {
    if (result?.questionnaire) {
      acceptQuestionnaire(result.questionnaire);
      return true;
    }
    if (result?.requiresReload) {
      setRequiresReload(true);
      return false;
    }
    return false;
  }, [acceptQuestionnaire]);

  const markConflict = useCallback(() => setServerConflict(true), []);

  const stats = useMemo(() => getQuestionnaireStats(draft?.items || []), [draft?.items]);
  const activeStats = useMemo(() => getQuestionnaireStats(
    questionnaire?.active_items || (questionnaire?.is_published ? questionnaire.items || [] : [])
  ), [questionnaire]);

  const includedIds = useMemo(() => new Set(
    (draft?.items || []).map(item => Number(item.parameter_id))
  ), [draft?.items]);

  const excludedIds = useMemo(() => new Set(
    (draft?.excludedParameterIds || []).map(Number)
  ), [draft?.excludedParameterIds]);

  return {
    draft, original, dirty, locked, editable, serverConflict,
    requiresReload, stats, activeStats, includedIds, excludedIds,
    hasPendingDraft, isActive,
    addQuestion, addQuestions, removeQuestion, changeWeightage,
    restoreWeightage, reorder, discardChanges, acceptQuestionnaire,
    acceptMutation, markConflict, clearDraft
  };
}