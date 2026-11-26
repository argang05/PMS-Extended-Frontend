export const potentialKeys = {
    all: ["potential"],
    questionBank: {
      all: ["potential", "question-bank"],
      categories: () => ["potential", "question-bank", "categories"],
      questions: () => ["potential", "question-bank", "questions"],
      lists: () => ["potential", "question-bank", "questions", "list"],
      list: (filters = {}) => ["potential", "question-bank", "questions", "list", filters],
      detail: id => ["potential", "question-bank", "questions", "detail", String(id)],
      targetingOptions: () => ["potential", "question-bank", "targeting-options"],
      targeting: id => ["potential", "question-bank", "targeting", String(id)],
      stats: () => ["potential", "question-bank", "stats"]
    },
    questionnaires: {
      all: ["potential", "questionnaires"],
      options: () => ["potential", "questionnaires", "options"],
      lists: () => ["potential", "questionnaires", "list"],
      list: (filters = {}) => ["potential", "questionnaires", "list", filters],
      detail: id => ["potential", "questionnaires", "detail", String(id)],
      availableQuestionsRoot: id => ["potential", "questionnaires", "available-questions", String(id)],
      availableQuestions: (id, filters = {}) => ["potential", "questionnaires", "available-questions", String(id), filters]
    },
    evaluations: {
      all: ["potential", "evaluations"],
      lists: () => ["potential", "evaluations", "list"],
      list: (filters = {}) => ["potential", "evaluations", "list", filters],
      detail: id => ["potential", "evaluations", "detail", String(id)]
    },
    descriptive: {
      all: ["potential", "descriptive"],
      assessment: id => ["potential", "descriptive", String(id)],
      preference: id => ["potential", "descriptive", String(id), "preference"],
      workspace: id => ["potential", "descriptive", String(id), "workspace"],
      readiness: id => ["potential", "descriptive", String(id), "readiness"],
      history: id => ["potential", "descriptive", String(id), "history"]
    },
    scoring: {
      all: ["potential", "scoring"],
      result: id => ["potential", "scoring", "result", String(id)]
    }
  };