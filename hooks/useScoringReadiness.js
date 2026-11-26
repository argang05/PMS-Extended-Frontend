"use client";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SCORING_ENGINES, fetchScoringReadiness, getReadinessError,
  getEngineReadinessSummary, getAnalyticsReleaseSummary, getScoringProgress
} from "@/lib/scoring/readinessAPI";

export const scoringReadinessKeys = {
  all: ["scoring-readiness"],
  details: () => ["scoring-readiness", "detail"],
  questionnaire: questionnaireId => ["scoring-readiness", "detail", String(questionnaireId)],
  detail: (questionnaireId, employeeNumber) => ["scoring-readiness", "detail", String(questionnaireId), String(employeeNumber ?? "")]
};

function isValidQuestionnaireId(id) {
  return /^[1-9]\d*$/.test(String(id ?? ""));
}

export function useScoringReadiness(accessToken, questionnaireId, employeeNumber) {
  const queryClient = useQueryClient();
  const enabled = Boolean(accessToken && employeeNumber && isValidQuestionnaireId(questionnaireId));
  const queryKey = useMemo(() => scoringReadinessKeys.detail(questionnaireId, employeeNumber), [questionnaireId, employeeNumber]);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchScoringReadiness(accessToken, questionnaireId, signal),
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if ([400, 401, 403, 404, 409].includes(error?.status)) return false;
      return failureCount < 1;
    }
  });
  const loading = enabled && (query.isPending || query.isFetching);
  const unavailable = !enabled || query.isError || !query.data;
  const verified = Boolean(enabled && query.isSuccess && query.isFetchedAfterMount && !query.isFetching && !query.isError && query.data);
  const readiness = enabled && !query.isError ? query.data ?? null : null;
  const engines = useMemo(() => Object.fromEntries(SCORING_ENGINES.map(engine => {
    const summary = getEngineReadinessSummary(readiness?.[engine], loading);
    return [engine, {
      ...summary,
      canCalculate: verified && summary.canCalculate,
      isCurrent: verified && summary.isCurrent
    }];
  })), [readiness, loading, verified]);
  const analyticsRelease = useMemo(() => {
    const summary = getAnalyticsReleaseSummary(readiness, loading);
    return {
      ...summary,
      canRelease: verified && summary.canRelease,
      canUnrelease: verified && summary.canUnrelease
    };
  }, [readiness, loading, verified]);
  const progress = useMemo(() => getScoringProgress(readiness), [readiness]);
  const refetch = query.refetch;
  const refresh = useCallback(async (options = {}) => {
    if (!enabled) return null;
    const force = options.force !== false;
    if (force) await queryClient.cancelQueries({ queryKey, exact: true });
    const result = await refetch({ cancelRefetch: force, throwOnError: true });
    return result.data ?? null;
  }, [enabled, queryClient, queryKey, refetch]);
  const invalidate = useCallback(async () => {
    if (!enabled) return;
    await queryClient.invalidateQueries({
      queryKey: scoringReadinessKeys.questionnaire(questionnaireId),
      refetchType: "active"
    }, { throwOnError: true });
  }, [enabled, questionnaireId, queryClient]);
  const getEngine = useCallback(engine => engines[engine] ?? getEngineReadinessSummary(null), [engines]);
  const canCalculate = useCallback(engine => engines[engine]?.canCalculate === true, [engines]);
  const isCurrent = useCallback(engine => engines[engine]?.isCurrent === true, [engines]);
  const getCalculationBlockers = useCallback(engine => engines[engine]?.calculationBlockers ?? [], [engines]);
  const getFreshnessBlockers = useCallback(engine => engines[engine]?.freshnessBlockers ?? [], [engines]);
  return {
    readiness, engines, analyticsRelease, progress, enabled, loading,
    isLoading: enabled && query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    unavailable, verified,
    error: query.isError ? getReadinessError(query.error) : "",
    updatedAt: query.dataUpdatedAt || null,
    refresh, invalidate, getEngine, canCalculate, isCurrent,
    getCalculationBlockers, getFreshnessBlockers
  };
}

export function useScoringReadinessInvalidation() {
  const queryClient = useQueryClient();
  const invalidateQuestionnaire = useCallback(async questionnaireId => {
    if (!isValidQuestionnaireId(questionnaireId)) return;
    await queryClient.invalidateQueries({
      queryKey: scoringReadinessKeys.questionnaire(questionnaireId),
      refetchType: "active"
    }, { throwOnError: true });
  }, [queryClient]);
  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: scoringReadinessKeys.all,
      refetchType: "active"
    }, { throwOnError: true });
  }, [queryClient]);
  const removeQuestionnaire = useCallback(async questionnaireId => {
    if (!isValidQuestionnaireId(questionnaireId)) return;
    const queryKey = scoringReadinessKeys.questionnaire(questionnaireId);
    await queryClient.cancelQueries({ queryKey });
    queryClient.removeQueries({ queryKey });
  }, [queryClient]);
  const clearReadinessCache = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: scoringReadinessKeys.all });
    queryClient.removeQueries({ queryKey: scoringReadinessKeys.all });
  }, [queryClient]);
  return { invalidateQuestionnaire, invalidateAll, removeQuestionnaire, clearReadinessCache };
}