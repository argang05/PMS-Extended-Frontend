
"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ANALYTICS_QUERY_KEY = ["employee-analytics"];
const ANALYTICS_CHANNEL = "tor-pms-analytics-release";
const REFRESH_INTERVAL = 30000;

export function getMyAnalyticsQueryKey(employeeNumber, accessToken) {
  return [...ANALYTICS_QUERY_KEY, String(employeeNumber || ""), accessToken || ""];
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function unavailable(questionnaireId = null, message = "Analytics report is not currently available.") {
  return { available: false, questionnaireId, report: null, message };
}

async function fetchMyAnalytics(accessToken, signal) {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  const timeout = setTimeout(abortRequest, 15000);
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortRequest, { once: true });
  try {
    const options = {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal
    };
    const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/evaluations/self-review-status/`, options);
    const statusData = await readResponse(statusRes);
    if ([401, 403, 404].includes(statusRes.status)) {
      return unavailable(null, "No accessible questionnaire found for your account.");
    }
    if (!statusRes.ok) throw new Error(statusData?.message || statusData?.error || "Unable to verify questionnaire status.");
    const questionnaireId = statusData?.questionnaire_id;
    if (!questionnaireId) return unavailable(null, "No questionnaire found for your account.");
    const response = await fetch(`/api/scoring/my-analytics/${questionnaireId}`, options);
    const data = await readResponse(response);
    if ([401, 403, 404, 409].includes(response.status)) {
      return unavailable(questionnaireId, data?.message || data?.error);
    }
    if (!response.ok) throw new Error(data?.message || data?.error || "Unable to retrieve analytics report.");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid analytics report response.");
    return { available: true, questionnaireId, report: data, message: "" };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortRequest);
  }
}

function invalidateAnalytics(queryClient, details = {}) {
  const employeeNumber = String(details.employeeNumber || "");
  const predicate = query => {
    const key = query.queryKey;
    return key[0] === ANALYTICS_QUERY_KEY[0] && (!employeeNumber || String(key[1]) === employeeNumber);
  };
  if (details.isReleased === false) {
    queryClient.setQueriesData({ predicate }, previous => {
      if (!previous) return previous;
      if (details.questionnaireId && String(previous.questionnaireId) !== String(details.questionnaireId)) return previous;
      return unavailable(previous.questionnaireId, "Your analytics report is no longer available.");
    });
  }
  return queryClient.invalidateQueries({ predicate });
}

export function notifyAnalyticsReleaseChanged(queryClient, details = {}) {
  const payload = {
    questionnaireId: details.questionnaireId ?? null,
    employeeNumber: String(details.employeeNumber || ""),
    isReleased: details.isReleased ?? null
  };
  const result = invalidateAnalytics(queryClient, payload);
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(ANALYTICS_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch (error) {
      console.warn("Analytics broadcast unavailable:", error);
    }
  }
  return result;
}

export function useMyAnalytics(accessToken, employeeNumber) {
  const queryClient = useQueryClient();
  const identity = String(employeeNumber || "");
  const enabled = Boolean(accessToken && identity);
  const query = useQuery({
    queryKey: getMyAnalyticsQueryKey(identity, accessToken),
    queryFn: ({ signal }) => fetchMyAnalytics(accessToken, signal),
    enabled,
    staleTime: 20000,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchInterval: enabled ? REFRESH_INTERVAL : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    refetchOnMount: true
  });

  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === "undefined") return;
    let channel;
    try {
      channel = new BroadcastChannel(ANALYTICS_CHANNEL);
      channel.onmessage = event => {
        const payload = event.data || {};
        if (payload.employeeNumber && String(payload.employeeNumber) !== identity) return;
        invalidateAnalytics(queryClient, payload).catch(console.error);
      };
    } catch (error) {
      console.warn("Analytics synchronization unavailable:", error);
    }
    return () => channel?.close();
  }, [enabled, identity, queryClient]);

  const available = enabled && !query.isError && query.data?.available === true;
  return {
    ...query,
    available,
    report: available ? query.data.report : null,
    questionnaireId: enabled ? query.data?.questionnaireId ?? null : null,
    loading: enabled && query.isPending,
    message: query.isError ? query.error?.message || "Unable to verify analytics availability." : query.data?.message || ""
  };
}
