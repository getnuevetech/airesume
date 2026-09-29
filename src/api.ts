export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    mfaRequired?: boolean;
    mfaEnrolled?: boolean;
    mustChangePassword?: boolean;
  };
  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status}).`) as Error & {
      status?: number;
      mfaRequired?: boolean;
      mfaEnrolled?: boolean;
      mustChangePassword?: boolean;
    };
    err.status = response.status;
    err.mfaRequired = Boolean(data.mfaRequired);
    err.mfaEnrolled = Boolean(data.mfaEnrolled);
    err.mustChangePassword = Boolean(data.mustChangePassword);
    throw err;
  }
  return data;
}
