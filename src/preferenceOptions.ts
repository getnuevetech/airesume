import preferenceOptions from "../shared/preference-options.json";

export type PreferenceOption = { value: string; label: string };

export const SALARY_RANGE_OPTIONS = preferenceOptions.salaryRanges as PreferenceOption[];
export const WORK_ARRANGEMENT_OPTIONS = preferenceOptions.workArrangements as PreferenceOption[];
export const WORK_AUTHORIZATION_OPTIONS = preferenceOptions.workAuthorizations as PreferenceOption[];

export function optionsForPreferenceKey(key: string): PreferenceOption[] | null {
  if (key === "salary") return SALARY_RANGE_OPTIONS;
  if (key === "workArrangement") return WORK_ARRANGEMENT_OPTIONS;
  if (key === "workAuthorization") return WORK_AUTHORIZATION_OPTIONS;
  return null;
}
