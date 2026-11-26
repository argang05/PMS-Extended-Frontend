"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPotentialAPI } from "@/lib/api/potential";
import { potentialKeys } from "@/lib/queryKeys/potential";
import {
  normalizeQuestionnaire, normalizeAvailableQuestions,
  buildQuestionnaireDraftPayload
} from "@/lib/potential/questionnaireUtils";

const keys = potentialKeys.questionnaires;

function queryOptions(accessToken) {
  return {
    enabled: Boolean(accessToken),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (count, error) => ![400, 401, 403, 404, 409].includes(error?.status) && count < 2
  };
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? data?.questionnaires ?? data?.assessments ?? [];
}

function getCompleteQuestionnaire(data, id) {
  const questionnaire = data?.questionnaire ?? data?.assessment ?? data;
  if (
    !questionnaire?.id ||
    Number(questionnaire.id) !== Number(id) ||
    !(questionnaire.revision ?? questionnaire.updated_at) ||
    !Array.isArray(questionnaire.items) ||
    !Array.isArray(questionnaire.customizations) ||
    typeof questionnaire.is_published !== "boolean" ||
    typeof questionnaire.is_locked !== "boolean" ||
    typeof questionnaire.has_customization_draft !== "boolean" ||
    !Array.isArray(questionnaire.active_items)
  ) return null;
  return questionnaire;
}

export function usePotentialQuestionnaires(accessToken, filters = {}) {
  const api = useMemo(() => createPotentialAPI(accessToken).questionnaires, [accessToken]);
  const options = useQuery({
    ...queryOptions(accessToken),
    queryKey: keys.options(),
    queryFn: ({ signal }) => api.getOptions(signal)
  });
  const questionnaires = useQuery({
    ...queryOptions(accessToken),
    queryKey: keys.list(filters),
    queryFn: ({ signal }) => api.getQuestionnaires(filters, signal)
  });
  return {
    options: options.data,
    questionnaires: normalizeList(questionnaires.data),
    queries: { options, questionnaires },
    isLoading: options.isLoading || questionnaires.isLoading,
    isFetching: options.isFetching || questionnaires.isFetching,
    error: options.error || questionnaires.error,
    refetch: () => Promise.all([options.refetch(), questionnaires.refetch()])
  };
}

export function usePotentialQuestionnaire(accessToken, questionnaireId) {
  const api = useMemo(() => createPotentialAPI(accessToken).questionnaires, [accessToken]);
  return useQuery({
    ...queryOptions(accessToken),
    enabled: Boolean(accessToken && questionnaireId),
    queryKey: keys.detail(questionnaireId),
    queryFn: async ({ signal }) => normalizeQuestionnaire(await api.getQuestionnaire(questionnaireId, signal))
  });
}

export function usePotentialAvailableQuestions(accessToken, questionnaireId, filters = {}, enabled = true) {
  const api = useMemo(() => createPotentialAPI(accessToken).questionnaires, [accessToken]);
  return useQuery({
    ...queryOptions(accessToken),
    enabled: Boolean(accessToken && questionnaireId && enabled),
    queryKey: keys.availableQuestions(questionnaireId, filters),
    queryFn: async ({ signal }) => normalizeAvailableQuestions(
      await api.getAvailableQuestions(questionnaireId, filters, signal)
    )
  });
}

export function usePotentialQuestionnaireMutations(accessToken) {
  const queryClient = useQueryClient();
  const api = useMemo(() => createPotentialAPI(accessToken).questionnaires, [accessToken]);

  const reconcile = async (id, mutationResponse, { activeChanged = false } = {}) => {
    await queryClient.cancelQueries({ queryKey: keys.detail(id), exact: true });
    let questionnaire = getCompleteQuestionnaire(mutationResponse, id);
    let reconciliationError = null;
    if (!questionnaire) {
      try {
        questionnaire = normalizeQuestionnaire(await api.getQuestionnaire(id));
      } catch (error) {
        reconciliationError = error;
      }
    }
    if (questionnaire) {
      queryClient.setQueryData(keys.detail(id), questionnaire);
    } else {
      await queryClient.invalidateQueries({
        queryKey: keys.detail(id), exact: true, refetchType: "none"
      });
    }
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: keys.lists() }),
      queryClient.invalidateQueries({ queryKey: keys.availableQuestionsRoot(id) })
    ];
    if (activeChanged) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: potentialKeys.evaluations.all }),
        queryClient.invalidateQueries({ queryKey: potentialKeys.descriptive.assessment(id) }),
        queryClient.invalidateQueries({ queryKey: potentialKeys.questionBank.all })
      );
    }
    await Promise.allSettled(invalidations);
    return {
      id,
      questionnaire,
      mutationResponse,
      reconciliationError,
      requiresReload: Boolean(reconciliationError)
    };
  };

  const create = useMutation({
    retry: false,
    mutationFn: async payload => {
      const response = await api.createQuestionnaire(payload);
      const id = response?.questionnaire?.id ?? response?.assessment?.id ?? response?.id;
      if (!id) {
        await queryClient.invalidateQueries({ queryKey: keys.lists() });
        return { mutationResponse: response, requiresReload: true };
      }
      return reconcile(id, response, { activeChanged: true });
    }
  });

  const saveDraft = useMutation({
    retry: false,
    mutationFn: async draft => {
      const response = await api.saveDraft(draft.questionnaireId, buildQuestionnaireDraftPayload(draft));
      return reconcile(draft.questionnaireId, response);
    }
  });

  const synchronize = useMutation({
    retry: false,
    mutationFn: async ({ id, revision }) => {
      const response = await api.synchronize(id, { revision });
      return reconcile(id, response);
    }
  });

  const reset = useMutation({
    retry: false,
    mutationFn: async ({ id, revision }) => {
      const response = await api.reset(id, { revision });
      return reconcile(id, response);
    }
  });

  const copy = useMutation({
    retry: false,
    mutationFn: async ({ id, sourceId, revision, copyWeightages = true }) => {
      const response = await api.copy(id, {
        source_assessment_id: Number(sourceId),
        copy_weightages: Boolean(copyWeightages),
        revision
      });
      return reconcile(id, response);
    }
  });

  const publish = useMutation({
    retry: false,
    mutationFn: async ({ id, revision, confirmReset = false }) => {
      const response = await api.publish(id, {
        revision,
        confirm_reset: confirmReset === true
      });
      return reconcile(id, response, { activeChanged: true });
    }
  });

  const mutations = { create, saveDraft, synchronize, reset, copy, publish };
  return {
    ...mutations,
    isMutating: Object.values(mutations).some(mutation => mutation.isPending)
  };
}