import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../api";

type Permission = { key: string; label: string; detail: string };
type PermissionGroup = { id: string; label: string; permissions: Permission[] };
type AccessLevel = {
  id: string;
  name: string;
  detail: string;
  isSuper: boolean;
  permissions: string[];
};

type Payload = {
  groups: PermissionGroup[];
  permissions: Permission[];
  levels: AccessLevel[];
};

export function AccessLevelsAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(preferId?: string) {
    const payload = await api<Payload>("/api/admin/access-levels");
    setData(payload);
    const nextId = preferId || selectedId || payload.levels[0]?.id || "";
    const level = payload.levels.find((item) => item.id === nextId) || payload.levels[0];
    if (level) {
      setSelectedId(level.id);
      setName(level.name);
      setDetail(level.detail);
      setPermissions([...level.permissions]);
    }
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  const selected = useMemo(
    () => data?.levels.find((level) => level.id === selectedId) || null,
    [data, selectedId],
  );

  function selectLevel(level: AccessLevel) {
    setSelectedId(level.id);
    setName(level.name);
    setDetail(level.detail);
    setPermissions([...level.permissions]);
    setMessage("");
    setError("");
  }

  function togglePermission(key: string) {
    if (selected?.isSuper) return;
    setPermissions((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleGroup(group: PermissionGroup, enabled: boolean) {
    if (selected?.isSuper) return;
    const keys = group.permissions.map((item) => item.key);
    setPermissions((current) => {
      const without = current.filter((key) => !keys.includes(key));
      return enabled ? [...new Set([...without, ...keys, "admin.portal.access"])] : without;
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ level: AccessLevel; levels: AccessLevel[] }>(`/api/admin/access-levels/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, detail, permissions }),
      });
      setData((prev) => (prev ? { ...prev, levels: result.levels } : prev));
      setMessage(`Saved ${result.level.name}.`);
      selectLevel(result.level);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save access level.");
    } finally {
      setBusy(false);
    }
  }

  async function createLevel() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ level: AccessLevel; levels: AccessLevel[] }>("/api/admin/access-levels", {
        method: "POST",
        body: JSON.stringify({
          name: "New access level",
          detail: "Custom admin permissions",
          permissions: ["admin.portal.access", "admin.homepage.read"],
        }),
      });
      setData((prev) => (prev ? { ...prev, levels: result.levels } : prev));
      selectLevel(result.level);
      setMessage("Created a new access level. Adjust permissions and save.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create access level.");
    } finally {
      setBusy(false);
    }
  }

  async function removeLevel() {
    if (!selected || selected.isSuper) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ levels: AccessLevel[] }>(`/api/admin/access-levels/${selected.id}`, { method: "DELETE" });
      setData((prev) => (prev ? { ...prev, levels: result.levels } : prev));
      const next = result.levels[0];
      if (next) selectLevel(next);
      setMessage("Access level deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete access level.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p>{error || "Loading access levels…"}</p>;

  return (
    <div>
      <header className="admin-head">
        <div>
          <h1>Access levels</h1>
          <p className="role">
            Super Admin can create admin levels and choose which Admin portal features each level may use.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void createLevel()}>
          Add access level
        </button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}

      <div className="admin-grid" style={{ alignItems: "start" }}>
        <section className="admin-card">
          <h2>Levels</h2>
          <div className="admin-table">
            {data.levels.map((level) => (
              <article key={level.id}>
                <div>
                  <strong>{level.name}</strong>
                  <p className="role">
                    {level.isSuper ? "Full access · cannot delete" : `${level.permissions.length} permissions`}
                    {level.detail ? ` · ${level.detail}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className={selectedId === level.id ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                  onClick={() => selectLevel(level)}
                >
                  {selectedId === level.id ? "Editing" : "Edit"}
                </button>
              </article>
            ))}
          </div>
        </section>

        {selected ? (
          <form className="admin-card" onSubmit={(event) => void save(event)}>
            <h2>{selected.isSuper ? "Super Admin" : "Edit level"}</h2>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required disabled={selected.isSuper} />
            </label>
            <label className="field">
              <span>Description</span>
              <input value={detail} onChange={(event) => setDetail(event.target.value)} disabled={selected.isSuper} />
            </label>
            {selected.isSuper ? (
              <p className="role">Super Admin always includes every Admin portal permission.</p>
            ) : null}
            {data.groups.map((group) => {
              const keys = group.permissions.map((item) => item.key);
              const enabledCount = keys.filter((key) => permissions.includes(key)).length;
              const allOn = enabledCount === keys.length;
              return (
                <div className="admin-subcard" key={group.id}>
                  <div className="admin-head" style={{ marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{group.label}</h3>
                    <label className="check-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={allOn}
                        disabled={selected.isSuper}
                        onChange={(event) => toggleGroup(group, event.target.checked)}
                      />
                      All
                    </label>
                  </div>
                  {group.permissions.map((permission) => (
                    <label className="check-row" key={permission.key}>
                      <input
                        type="checkbox"
                        checked={selected.isSuper || permissions.includes(permission.key)}
                        disabled={selected.isSuper || permission.key === "admin.portal.access"}
                        onChange={() => togglePermission(permission.key)}
                      />
                      <span>
                        <strong>{permission.label}</strong>
                        <span className="role" style={{ display: "block" }}>
                          {permission.detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              );
            })}
            <div className="admin-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={busy || selected.isSuper}>
                {busy ? "Saving…" : "Save access level"}
              </button>
              {!selected.isSuper ? (
                <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void removeLevel()}>
                  Delete level
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
