import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const options = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "preference-options.json"), "utf8"),
);

export const SALARY_RANGE_OPTIONS = options.salaryRanges;
export const WORK_ARRANGEMENT_OPTIONS = options.workArrangements;
export const WORK_AUTHORIZATION_OPTIONS = options.workAuthorizations;

export function preferenceOptionValues(list) {
  return (list || []).map((item) => item.value).filter(Boolean);
}

/** Parse a salary preference (range label or free text) into a target minimum for matching. */
export function parseTargetSalary(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (/under|below|less than/i.test(text)) return 0;
  const nums = [...text.matchAll(/(\d[\d,]*)/g)].map((match) => Number(String(match[1]).replace(/,/g, "")));
  if (!nums.length) return 0;
  if (/\+|or more|and above/i.test(text)) return nums[0];
  return Math.min(...nums);
}

export function isKnownSalaryOption(value) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return preferenceOptionValues(SALARY_RANGE_OPTIONS).includes(clean);
}

export function isKnownWorkArrangement(value) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return preferenceOptionValues(WORK_ARRANGEMENT_OPTIONS).includes(clean);
}

export function isKnownWorkAuthorization(value) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return preferenceOptionValues(WORK_AUTHORIZATION_OPTIONS).includes(clean);
}
