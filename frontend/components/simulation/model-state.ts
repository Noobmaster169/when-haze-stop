import type { ModelSkill } from "@/lib/api/simulation-schemas";

/** One sentence on where the learned model stands against the shadow rule, in the page's own words. The numbers are the backend's. */

function gainWords(model: ModelSkill): string {
  if (model.gain === null) return "not yet comparable with the hourly forecast";
  const percent = Math.round(Math.abs(model.gain) * 100);
  return `${percent}% ${model.gain < 0 ? "worse" : "better"} than the hourly forecast a day ahead at DOE stations`;
}

export function shadowSummary(model: ModelSkill): string {
  if (model.mode === "off") return "Not running. Nothing on this page comes from a learned model.";
  if (model.mode === "live") return `Live: the outlook for the days ahead is this model's. ${model.shadowDays} days scored, ${gainWords(model)}.`;
  const scored = `In shadow: ${model.shadowDays} of ${model.shadowDaysRequired} days scored, ${gainWords(model)}.`;
  if (model.passed) return `${scored} The rule has passed; it may be set live.`;
  // The rule has two conditions; name the one still missing so the sentence never contradicts the numbers.
  const daysLeft = model.shadowDaysRequired - model.shadowDays;
  const missing = daysLeft > 0 ? `${daysLeft} more ${daysLeft === 1 ? "day" : "days"} of shadow data` : `${Math.round(model.gainRequired * 100)}% better`;
  return `${scored} Needs ${missing}. Nothing a person sees comes from it yet.`;
}
