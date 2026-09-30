import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PERMISSION_KEYS,
  adminHasPermission,
  createAccessLevel,
  deleteAccessLevel,
  listAccessLevels,
  permissionsForAdminUser,
  seedAdminAccessLevels,
  SUPER_LEVEL_ID,
  updateAccessLevel,
} from "./admin-access.mjs";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db, id } from "./db.mjs";

test("schema 29+ seeds admin access levels and permission catalog", () => {
  assert.ok(SCHEMA_VERSION >= 29);
  migrate();
  seedAdminAccessLevels();
  assert.ok(ADMIN_PERMISSION_KEYS.includes("admin.homepage.write"));
  assert.ok(ADMIN_PERMISSION_KEYS.includes("admin.access_levels.write"));
  assert.ok(db.prepare("SELECT id FROM admin_access_levels WHERE id = ?").get(SUPER_LEVEL_ID));
  assert.ok(listAccessLevels().length >= 5);
  assert.ok(db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === "admin_access_level_id"));
});

test("super admin has every permission; custom levels are scoped", () => {
  migrate();
  seedAdminAccessLevels();
  const superUser = { role: "admin", admin_access_level_id: SUPER_LEVEL_ID };
  assert.equal(adminHasPermission(superUser, "admin.access_levels.write"), true);
  assert.equal(permissionsForAdminUser(superUser).length, ADMIN_PERMISSION_KEYS.length);

  const created = createAccessLevel({
    name: "Homepage only",
    detail: "CMS",
    permissions: ["admin.homepage.read", "admin.homepage.write"],
  });
  assert.equal(created.ok, true);
  const limited = { role: "admin", admin_access_level_id: created.level.id };
  assert.equal(adminHasPermission(limited, "admin.portal.access"), true);
  assert.equal(adminHasPermission(limited, "admin.homepage.write"), true);
  assert.equal(adminHasPermission(limited, "admin.plans.write"), false);

  const updated = updateAccessLevel(created.level.id, {
    permissions: ["admin.launch.read"],
  });
  assert.equal(updated.ok, true);
  assert.equal(adminHasPermission({ role: "admin", admin_access_level_id: created.level.id }, "admin.launch.read"), true);
  assert.equal(adminHasPermission({ role: "admin", admin_access_level_id: created.level.id }, "admin.homepage.write"), false);

  assert.equal(deleteAccessLevel(SUPER_LEVEL_ID).ok, false);
  assert.equal(deleteAccessLevel(created.level.id).ok, true);
});

test("admins without a level default to Super Admin permissions", () => {
  migrate();
  seedAdminAccessLevels();
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider, role, status, created_at, admin_access_level_id)
     VALUES (?, 'Temp Admin', ?, '', 'email', 'admin', 'active', ?, NULL)`,
  ).run(userId, `temp-${userId}@example.com`, Date.now());
  seedAdminAccessLevels();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  assert.equal(row.admin_access_level_id, SUPER_LEVEL_ID);
  assert.equal(adminHasPermission(row, "admin.access_levels.write"), true);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
});
