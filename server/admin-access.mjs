/** Granular admin portal permissions and access levels for RBAC. */

import { db, id } from "./db.mjs";

export const ADMIN_PERMISSION_GROUPS = [
  {
    id: "portal",
    label: "Portal",
    permissions: [
      { key: "admin.portal.access", label: "Open Admin portal", detail: "Sign in to /admin and see allowed tabs." },
    ],
  },
  {
    id: "homepage",
    label: "Homepage CMS",
    permissions: [
      { key: "admin.homepage.read", label: "View homepage CMS", detail: "Open the Homepage editor." },
      { key: "admin.homepage.write", label: "Save homepage CMS", detail: "Edit and save landing-page content." },
      { key: "admin.homepage.upload", label: "Upload CMS media", detail: "Upload hero and testimonial images." },
    ],
  },
  {
    id: "launch",
    label: "Launch",
    permissions: [
      { key: "admin.launch.read", label: "View launch readiness", detail: "See production launch checks." },
    ],
  },
  {
    id: "security",
    label: "Security",
    permissions: [
      { key: "admin.security.mfa_policy.read", label: "View MFA policy", detail: "See which account types require MFA." },
      { key: "admin.security.mfa_policy.write", label: "Edit MFA policy", detail: "Enable or disable MFA by account type." },
    ],
  },
  {
    id: "users",
    label: "Candidates",
    permissions: [
      { key: "admin.users.read", label: "List candidates", detail: "View candidate accounts." },
      { key: "admin.users.create", label: "Create candidates", detail: "Add candidate accounts." },
      { key: "admin.users.status.write", label: "Enable or disable candidates", detail: "Activate or disable candidate accounts." },
      { key: "admin.users.plan.write", label: "Assign candidate plans", detail: "Change a candidate’s plan." },
      { key: "admin.users.reset_link", label: "Candidate password reset links", detail: "Issue password reset links for candidates." },
      { key: "admin.users.promote_admin", label: "Promote candidate to admin", detail: "Grant admin access to a candidate." },
      { key: "admin.users.activity.read", label: "View candidate activity", detail: "See the account log and the operations log for a candidate." },
      { key: "admin.users.activity.complete", label: "Record a stuck checkout", detail: "Record an unfinished payment return on the manual ledger." },
    ],
  },
  {
    id: "admins",
    label: "Admins",
    permissions: [
      { key: "admin.admins.read", label: "List admins", detail: "View admin accounts." },
      { key: "admin.admins.create", label: "Create admins", detail: "Add admin accounts." },
      { key: "admin.admins.status.write", label: "Enable or disable admins", detail: "Activate or disable other admins." },
      { key: "admin.admins.plan.write", label: "Assign admin plans", detail: "Change an admin’s plan." },
      { key: "admin.admins.reset_link", label: "Admin password reset links", detail: "Issue password reset links for admins." },
      { key: "admin.admins.demote", label: "Demote admin to candidate", detail: "Remove admin access from an account." },
      { key: "admin.admins.level.write", label: "Assign admin access levels", detail: "Choose which access level an admin has." },
    ],
  },
  {
    id: "employers",
    label: "Employers",
    permissions: [
      { key: "admin.employers.read", label: "List employers", detail: "View employer accounts." },
      { key: "admin.employers.status.write", label: "Enable or disable employers", detail: "Activate or disable employer accounts." },
      { key: "admin.employers.plan.write", label: "Assign employer plans", detail: "Change an employer’s plan." },
      { key: "admin.employers.reset_link", label: "Employer password reset links", detail: "Issue password reset links for employers." },
    ],
  },
  {
    id: "email",
    label: "Email & audit",
    permissions: [
      { key: "admin.email.read", label: "View email settings", detail: "See SMTP configuration." },
      { key: "admin.email.write", label: "Edit email settings", detail: "Save SMTP host, credentials, and from address." },
      { key: "admin.email.test", label: "Send test email", detail: "Send a test message through SMTP." },
      { key: "admin.email.outbox.read", label: "View mail outbox", detail: "Read stored and sent messages." },
      { key: "admin.audit.read", label: "View AI audit log", detail: "See recent AI function calls." },
      { key: "admin.audit.costs.read", label: "View AI cost summaries", detail: "See estimated AI spend buckets." },
    ],
  },
  {
    id: "ai",
    label: "AI pipelines",
    permissions: [
      { key: "admin.ai.read", label: "View AI pipelines", detail: "See providers, assignments, prompts, and switches." },
      { key: "admin.ai.switches.write", label: "Toggle AI platform switches", detail: "Turn prompt registry and silent Auto-Apply on or off." },
      { key: "admin.ai.providers.create", label: "Add AI providers", detail: "Create provider pipelines and API keys." },
      { key: "admin.ai.providers.write", label: "Edit AI providers", detail: "Update provider settings and enable/disable." },
      { key: "admin.ai.providers.delete", label: "Delete AI providers", detail: "Remove provider pipelines." },
      { key: "admin.ai.assignments.write", label: "Assign AI functions", detail: "Map product functions to providers." },
      { key: "admin.ai.prompts.draft", label: "Save prompt drafts", detail: "Edit versioned prompt drafts." },
      { key: "admin.ai.prompts.publish", label: "Publish prompts", detail: "Publish draft prompts for runtime use." },
      { key: "admin.ai.prompts.rollback", label: "Rollback prompts", detail: "Roll back to a previous prompt version." },
    ],
  },
  {
    id: "plans",
    label: "Plans & billing rules",
    permissions: [
      { key: "admin.plans.read", label: "View plans", detail: "See plan matrix and feature flags." },
      { key: "admin.plans.create", label: "Create plans", detail: "Add new subscription plans." },
      { key: "admin.plans.write", label: "Edit plans", detail: "Change prices, features, and limits." },
      { key: "admin.plans.delete", label: "Delete plans", detail: "Remove unused plans." },
      { key: "admin.billing_policy.write", label: "Edit billing policy", detail: "Upgrade, downgrade, proration, and refund rules." },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    permissions: [
      { key: "admin.payments.gateways.read", label: "View payment gateways", detail: "See Stripe, PayPal, and manual gateways." },
      { key: "admin.payments.gateways.create", label: "Add payment gateways", detail: "Create gateway credentials." },
      { key: "admin.payments.gateways.write", label: "Edit payment gateways", detail: "Enable, disable, or update gateways." },
      { key: "admin.payments.events.read", label: "View billing ledger", detail: "See plan-change billing events." },
    ],
  },
  {
    id: "jobs",
    label: "Jobs & feeds",
    permissions: [
      { key: "admin.jobs.read", label: "View jobs and feeds", detail: "Browse job sources and listings." },
      { key: "admin.jobs.sources.create", label: "Add job feeds", detail: "Create feed sources." },
      { key: "admin.jobs.sources.write", label: "Edit job feeds", detail: "Update feed configuration." },
      { key: "admin.jobs.sources.delete", label: "Delete job feeds", detail: "Remove feeds and their jobs." },
      { key: "admin.jobs.pull", label: "Pull job feeds", detail: "Run feed pulls." },
      { key: "admin.jobs.create", label: "Create jobs manually", detail: "Add and categorize jobs by hand." },
      { key: "admin.jobs.delete", label: "Delete jobs", detail: "Remove individual job listings." },
    ],
  },
  {
    id: "access",
    label: "Access levels",
    permissions: [
      { key: "admin.access_levels.read", label: "View access levels", detail: "See admin access level definitions." },
      { key: "admin.access_levels.write", label: "Manage access levels", detail: "Create, edit, and delete admin access levels (super admin)." },
    ],
  },
];

export const ADMIN_PERMISSIONS = ADMIN_PERMISSION_GROUPS.flatMap((group) => group.permissions);
export const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSIONS.map((item) => item.key);

const SUPER_LEVEL_ID = "aal_super";
const PRESET_LEVELS = [
  {
    id: SUPER_LEVEL_ID,
    name: "Super Admin",
    detail: "Full Admin portal access. Can manage access levels.",
    isSuper: true,
    permissions: ADMIN_PERMISSION_KEYS,
  },
  {
    id: "aal_content",
    name: "Content Editor",
    detail: "Homepage CMS only.",
    isSuper: false,
    permissions: ["admin.portal.access", "admin.homepage.read", "admin.homepage.write", "admin.homepage.upload"],
  },
  {
    id: "aal_support",
    name: "Support",
    detail: "Help candidates and employers without changing platform config.",
    isSuper: false,
    permissions: [
      "admin.portal.access",
      "admin.users.read",
      "admin.users.create",
      "admin.users.status.write",
      "admin.users.plan.write",
      "admin.users.reset_link",
      "admin.users.activity.read",
      "admin.users.activity.complete",
      "admin.employers.read",
      "admin.employers.status.write",
      "admin.employers.plan.write",
      "admin.employers.reset_link",
      "admin.email.outbox.read",
    ],
  },
  {
    id: "aal_ops",
    name: "Operations",
    detail: "Launch checks, email, jobs, and AI audit.",
    isSuper: false,
    permissions: [
      "admin.portal.access",
      "admin.launch.read",
      "admin.email.read",
      "admin.email.write",
      "admin.email.test",
      "admin.email.outbox.read",
      "admin.audit.read",
      "admin.audit.costs.read",
      "admin.jobs.read",
      "admin.jobs.sources.create",
      "admin.jobs.sources.write",
      "admin.jobs.sources.delete",
      "admin.jobs.pull",
      "admin.jobs.create",
      "admin.jobs.delete",
    ],
  },
  {
    id: "aal_ai",
    name: "AI Ops",
    detail: "AI providers, assignments, prompts, and switches.",
    isSuper: false,
    permissions: [
      "admin.portal.access",
      "admin.ai.read",
      "admin.ai.switches.write",
      "admin.ai.providers.create",
      "admin.ai.providers.write",
      "admin.ai.providers.delete",
      "admin.ai.assignments.write",
      "admin.ai.prompts.draft",
      "admin.ai.prompts.publish",
      "admin.ai.prompts.rollback",
      "admin.audit.read",
      "admin.audit.costs.read",
    ],
  },
  {
    id: "aal_billing",
    name: "Billing",
    detail: "Plans, billing policy, and payment gateways.",
    isSuper: false,
    permissions: [
      "admin.portal.access",
      "admin.plans.read",
      "admin.plans.create",
      "admin.plans.write",
      "admin.plans.delete",
      "admin.billing_policy.write",
      "admin.payments.gateways.read",
      "admin.payments.gateways.create",
      "admin.payments.gateways.write",
      "admin.payments.events.read",
      "admin.users.activity.read",
      "admin.users.activity.complete",
      "admin.users.plan.write",
      "admin.employers.plan.write",
      "admin.admins.plan.write",
    ],
  },
];

export function knownAdminPermission(key) {
  return ADMIN_PERMISSION_KEYS.includes(String(key || ""));
}

export function publicPermissionCatalog() {
  return {
    groups: ADMIN_PERMISSION_GROUPS,
    permissions: ADMIN_PERMISSIONS,
  };
}

function normalizePermissionList(keys) {
  const set = new Set();
  for (const key of Array.isArray(keys) ? keys : []) {
    if (knownAdminPermission(key)) set.add(key);
  }
  if (!set.has("admin.portal.access") && set.size > 0) set.add("admin.portal.access");
  return [...set].sort();
}

export function listAccessLevels() {
  const levels = db
    .prepare("SELECT id, name, detail, is_super, created_at FROM admin_access_levels ORDER BY is_super DESC, name COLLATE NOCASE")
    .all();
  const permRows = db.prepare("SELECT level_id, permission_key FROM admin_access_level_permissions").all();
  const byLevel = new Map();
  for (const row of permRows) {
    if (!byLevel.has(row.level_id)) byLevel.set(row.level_id, []);
    byLevel.get(row.level_id).push(row.permission_key);
  }
  return levels.map((level) => ({
    id: level.id,
    name: level.name,
    detail: level.detail || "",
    isSuper: Boolean(level.is_super),
    createdAt: level.created_at,
    permissions: normalizePermissionList(byLevel.get(level.id) || (level.is_super ? ADMIN_PERMISSION_KEYS : [])),
  }));
}

export function getAccessLevel(levelId) {
  if (!levelId) return null;
  return listAccessLevels().find((level) => level.id === levelId) || null;
}

export function superAccessLevel() {
  return getAccessLevel(SUPER_LEVEL_ID) || listAccessLevels().find((level) => level.isSuper) || null;
}

function replaceLevelPermissions(levelId, permissions) {
  db.prepare("DELETE FROM admin_access_level_permissions WHERE level_id = ?").run(levelId);
  const insert = db.prepare(
    "INSERT INTO admin_access_level_permissions (level_id, permission_key) VALUES (?, ?)",
  );
  for (const key of normalizePermissionList(permissions)) {
    insert.run(levelId, key);
  }
}

export function createAccessLevel({ name, detail = "", permissions = [], isSuper = false } = {}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return { ok: false, error: "Name is required." };
  const levelId = id("aal");
  const now = Date.now();
  const keys = isSuper ? ADMIN_PERMISSION_KEYS : normalizePermissionList(permissions);
  db.prepare(
    `INSERT INTO admin_access_levels (id, name, detail, is_super, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(levelId, cleanName, String(detail || "").trim(), isSuper ? 1 : 0, now);
  replaceLevelPermissions(levelId, keys);
  return { ok: true, level: getAccessLevel(levelId) };
}

export function updateAccessLevel(levelId, { name, detail, permissions } = {}) {
  const existing = db.prepare("SELECT * FROM admin_access_levels WHERE id = ?").get(levelId);
  if (!existing) return { ok: false, error: "Access level not found." };
  const cleanName = name !== undefined ? String(name || "").trim() : existing.name;
  if (!cleanName) return { ok: false, error: "Name is required." };
  const nextDetail = detail !== undefined ? String(detail || "").trim() : existing.detail || "";
  db.prepare("UPDATE admin_access_levels SET name = ?, detail = ? WHERE id = ?").run(cleanName, nextDetail, levelId);
  if (permissions !== undefined) {
    const keys = existing.is_super ? ADMIN_PERMISSION_KEYS : normalizePermissionList(permissions);
    replaceLevelPermissions(levelId, keys);
  } else if (existing.is_super) {
    replaceLevelPermissions(levelId, ADMIN_PERMISSION_KEYS);
  }
  return { ok: true, level: getAccessLevel(levelId) };
}

export function deleteAccessLevel(levelId) {
  const existing = db.prepare("SELECT * FROM admin_access_levels WHERE id = ?").get(levelId);
  if (!existing) return { ok: false, error: "Access level not found." };
  if (existing.is_super) return { ok: false, error: "The Super Admin level cannot be deleted." };
  const assigned = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND admin_access_level_id = ?")
    .get(levelId);
  if (Number(assigned?.count || 0) > 0) {
    return { ok: false, error: "Reassign admins on this level before deleting it." };
  }
  db.prepare("DELETE FROM admin_access_level_permissions WHERE level_id = ?").run(levelId);
  db.prepare("DELETE FROM admin_access_levels WHERE id = ?").run(levelId);
  return { ok: true };
}

export function permissionsForAdminUser(user) {
  if (!user || user.role !== "admin") return [];
  const levelId = user.admin_access_level_id || SUPER_LEVEL_ID;
  const level = getAccessLevel(levelId);
  if (!level) {
    const superLevel = superAccessLevel();
    return superLevel?.permissions || [...ADMIN_PERMISSION_KEYS];
  }
  if (level.isSuper) return [...ADMIN_PERMISSION_KEYS];
  return level.permissions;
}

export function adminHasPermission(user, permissionKey) {
  if (!user || user.role !== "admin") return false;
  if (!permissionKey) return true;
  const permissions = permissionsForAdminUser(user);
  return permissions.includes(permissionKey);
}

export function isSuperAdminUser(user) {
  if (!user || user.role !== "admin") return false;
  const level = getAccessLevel(user.admin_access_level_id || SUPER_LEVEL_ID);
  return Boolean(level?.isSuper);
}

export function adminAccessSummary(user) {
  if (!user || user.role !== "admin") {
    return { accessLevelId: null, accessLevelName: null, isSuperAdmin: false, permissions: [] };
  }
  const level = getAccessLevel(user.admin_access_level_id || SUPER_LEVEL_ID) || superAccessLevel();
  const permissions = permissionsForAdminUser(user);
  return {
    accessLevelId: level?.id || SUPER_LEVEL_ID,
    accessLevelName: level?.name || "Super Admin",
    isSuperAdmin: Boolean(level?.isSuper),
    permissions,
  };
}

export function seedAdminAccessLevels() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_access_levels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      detail TEXT DEFAULT '',
      is_super INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_access_level_permissions (
      level_id TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      PRIMARY KEY (level_id, permission_key)
    );
  `);

  for (const preset of PRESET_LEVELS) {
    const existing = db.prepare("SELECT id FROM admin_access_levels WHERE id = ?").get(preset.id);
    if (!existing) {
      db.prepare(
        `INSERT OR IGNORE INTO admin_access_levels (id, name, detail, is_super, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(preset.id, preset.name, preset.detail, preset.isSuper ? 1 : 0, Date.now());
      replaceLevelPermissions(preset.id, preset.permissions);
    } else if (preset.isSuper) {
      db.prepare("UPDATE admin_access_levels SET name = ?, detail = ?, is_super = 1 WHERE id = ?").run(
        preset.name,
        preset.detail,
        preset.id,
      );
    }
  }

  const presetExtras = [
    ["aal_support", "admin.users.activity.read"],
    ["aal_support", "admin.users.activity.complete"],
    ["aal_billing", "admin.users.activity.read"],
    ["aal_billing", "admin.users.activity.complete"],
  ];
  const insertPresetPermission = db.prepare(
    "INSERT OR IGNORE INTO admin_access_level_permissions (level_id, permission_key) VALUES (?, ?)",
  );
  for (const [levelId, key] of presetExtras) insertPresetPermission.run(levelId, key);

  // Keep Super Admin permission set complete as new keys are added.
  const superCount = db
    .prepare("SELECT COUNT(*) AS count FROM admin_access_level_permissions WHERE level_id = ?")
    .get(SUPER_LEVEL_ID);
  if (Number(superCount?.count || 0) !== ADMIN_PERMISSION_KEYS.length) {
    replaceLevelPermissions(SUPER_LEVEL_ID, ADMIN_PERMISSION_KEYS);
  }

  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND (admin_access_level_id IS NULL OR admin_access_level_id = '')").all();
  for (const admin of admins) {
    db.prepare("UPDATE users SET admin_access_level_id = ? WHERE id = ?").run(SUPER_LEVEL_ID, admin.id);
  }
}

export { SUPER_LEVEL_ID };
