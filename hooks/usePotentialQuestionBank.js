"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPotentialAPI } from "@/lib/api/potential";
import { potentialKeys } from "@/lib/queryKeys/potential";

const keys = potentialKeys.questionBank;
const STALE_TIME = 5 * 60 * 1000;

export function normalizePotentialList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.questions)) return data.questions;
  if (Array.isArray(data?.categories)) return data.categories;
  return [];
}

function queryOptions(accessToken) {
  return {
    enabled: Boolean(accessToken),
    staleTime: STALE_TIME,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (count, error) => ![400, 401, 403, 404].includes(error?.status) && count < 2
  };
}

export function usePotentialQuestionBank(accessToken, filters = {}) {
  const api = useMemo(() => createPotentialAPI(accessToken).questionBank, [accessToken]);
  const options = queryOptions(accessToken);
  const categories = useQuery({
    ...options,
    queryKey: keys.categories(),
    queryFn: ({ signal }) => api.getCategories(signal)
  });
  const questions = useQuery({
    ...options,
    queryKey: keys.list(filters),
    queryFn: ({ signal }) => api.getQuestions(filters, signal)
  });
  const targetingOptions = useQuery({
    ...options,
    queryKey: keys.targetingOptions(),
    queryFn: ({ signal }) => api.getTargetingOptions(signal)
  });
  const stats = useQuery({
    ...options,
    queryKey: keys.stats(),
    queryFn: ({ signal }) => api.getStats(signal)
  });
  return {
    categories: normalizePotentialList(categories.data),
    questions: normalizePotentialList(questions.data),
    targetingOptions: targetingOptions.data,
    stats: stats.data,
    queries: { categories, questions, targetingOptions, stats },
    isLoading: categories.isLoading || questions.isLoading || targetingOptions.isLoading,
    isFetching: questions.isFetching,
    error: categories.error || questions.error || targetingOptions.error,
    refetch: () => Promise.all([
      categories.refetch(), questions.refetch(),
      targetingOptions.refetch(), stats.refetch()
    ])
  };
}

export function usePotentialQuestion(accessToken, questionId) {
  const api = useMemo(() => createPotentialAPI(accessToken).questionBank, [accessToken]);
  return useQuery({
    ...queryOptions(accessToken),
    enabled: Boolean(accessToken && questionId),
    queryKey: keys.detail(questionId),
    queryFn: ({ signal }) => api.getQuestion(questionId, signal)
  });
}

export function usePotentialQuestionTargeting(accessToken, questionId, enabled = true) {
  const api = useMemo(() => createPotentialAPI(accessToken).questionBank, [accessToken]);
  return useQuery({
    ...queryOptions(accessToken),
    enabled: Boolean(accessToken && questionId && enabled),
    queryKey: keys.targeting(questionId),
    queryFn: ({ signal }) => api.getQuestionTargeting(questionId, signal)
  });
}

export function usePotentialQuestionBankMutations(accessToken) {
  const queryClient = useQueryClient();
  const api = useMemo(() => createPotentialAPI(accessToken).questionBank, [accessToken]);

  const invalidateQuestions = async (ids = []) => {
    const tasks = [
      queryClient.invalidateQueries({ queryKey: keys.lists() }),
      queryClient.invalidateQueries({ queryKey: keys.stats() }),
      queryClient.invalidateQueries({ queryKey: potentialKeys.questionnaires.all })
    ];
    if (ids.length) {
      ids.forEach(id => {
        tasks.push(queryClient.invalidateQueries({ queryKey: keys.detail(id) }));
        tasks.push(queryClient.invalidateQueries({ queryKey: keys.targeting(id) }));
      });
    } else {
      tasks.push(queryClient.invalidateQueries({ queryKey: keys.questions() }));
      tasks.push(queryClient.invalidateQueries({ queryKey: [...keys.all, "targeting"] }));
    }
    await Promise.all(tasks);
  };

  const invalidateCategories = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.categories() }),
      invalidateQuestions()
    ]);
  };

  const createCategory = useMutation({
    mutationFn: api.createCategory,
    onSuccess: invalidateCategories
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }) => api.updateCategory(id, data),
    onSuccess: invalidateCategories
  });

  const deleteCategory = useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: invalidateCategories
  });

  const createQuestion = useMutation({
    mutationFn: api.createQuestion,
    onSuccess: async response => {
      const id = response?.question?.id ?? response?.id;
      await invalidateQuestions(id ? [id] : []);
    }
  });

  const updateQuestion = useMutation({
    mutationFn: ({ id, data }) => api.updateQuestion(id, data),
    onSuccess: async (_, variables) => {
      await invalidateQuestions([variables.id]);
    }
  });

  const deleteQuestion = useMutation({
    mutationFn: api.deleteQuestion,
    onSuccess: async (_, id) => {
      await queryClient.cancelQueries({ queryKey: keys.detail(id) });
      queryClient.removeQueries({ queryKey: keys.detail(id), exact: true });
      queryClient.removeQueries({ queryKey: keys.targeting(id), exact: true });
      await invalidateQuestions([id]);
    }
  });

  const bulkCreate = useMutation({
    mutationFn: api.bulkCreate,
    onSuccess: async () => invalidateQuestions()
  });

  const bulkConfigure = useMutation({
    mutationFn: api.bulkConfigure,
    onSuccess: async () => invalidateQuestions()
  });

  const bulkDelete = useMutation({
    mutationFn: api.bulkDelete,
    onSuccess: async () => invalidateQuestions()
  });

  const previewTargeting = useMutation({
    mutationFn: api.previewTargeting
  });

  const mutations = {
    createCategory, updateCategory, deleteCategory,
    createQuestion, updateQuestion, deleteQuestion,
    bulkCreate, bulkConfigure, bulkDelete, previewTargeting
  };

  return {
    ...mutations,
    isMutating: Object.entries(mutations).some(([key, mutation]) =>
      key !== "previewTargeting" && mutation.isPending
    )
  };
}