export function getScoringError(data, fallback = "Unable to calculate performance score.") {
    if (Array.isArray(data?.missing_requirements) && data.missing_requirements.length) {
      const details = data.missing_requirements.map((item, index) => {
        const parts = [];
        if (item.evaluator) parts.push(`Evaluator: ${item.evaluator}`);
        if (item.peer_id) parts.push(`Peer ID: ${item.peer_id}`);
        if (item.item_id) parts.push(`Question ID: ${item.item_id}`);
        if (item.component) parts.push(`Component: ${item.component}`);
        if (item.reason) parts.push(item.reason);
        return `${index + 1}. ${parts.join(" | ")}`;
      });
      return `${data.error || "Performance scoring incomplete."}\n${details.join("\n")}`;
    }
    return data?.error || data?.detail || data?.message || fallback;
  }
  
  export async function parseScoringResponse(response) {
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("Invalid response received from the scoring server.");
    }
    if (!response.ok) throw new Error(getScoringError(data, `Scoring request failed (${response.status}).`));
    return data;
  }