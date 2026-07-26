import { describe, it, expect, vi, beforeEach } from "vitest";

// Behavioral tests for the single authed-invoke abstraction.
// vi.hoisted so the mocks exist before the (hoisted) vi.mock factory runs.
const { getSession, invoke } = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, functions: { invoke } },
}));

import { authedInvoke } from "@/lib/authedInvoke";

beforeEach(() => {
  getSession.mockReset();
  invoke.mockReset();
});

describe("authedInvoke", () => {
  it("sends Authorization: Bearer <access_token> when a session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } });
    invoke.mockResolvedValue({ data: { ok: true }, error: null });

    const res = await authedInvoke("get-mapbox-token");

    expect(invoke).toHaveBeenCalledTimes(1);
    const [name, opts] = invoke.mock.calls[0];
    expect(name).toBe("get-mapbox-token");
    expect(opts.headers.Authorization).toBe("Bearer tok-1");
    expect(res.data).toEqual({ ok: true });
    expect(res.error).toBeNull();
  });

  it("returns a clear auth error WITHOUT invoking when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const res = await authedInvoke("get-mapbox-token");

    expect(invoke).not.toHaveBeenCalled();
    expect(res.data).toBeNull();
    expect(res.error).toBeInstanceOf(Error);
    expect(res.error?.message).toMatch(/AUTH_REQUIRED/);
  });

  it("reads a FRESH session per call (uses the refreshed token on the 2nd call)", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: { access_token: "old" } } })
      .mockResolvedValueOnce({ data: { session: { access_token: "new" } } });
    invoke.mockResolvedValue({ data: null, error: null });

    await authedInvoke("f");
    await authedInvoke("f");

    expect(invoke.mock.calls[0][1].headers.Authorization).toBe("Bearer old");
    expect(invoke.mock.calls[1][1].headers.Authorization).toBe("Bearer new");
  });

  it("appends query + forwards method for GET-style calls", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    invoke.mockResolvedValue({ data: null, error: null });

    await authedInvoke("podp-admin", undefined, {
      method: "GET",
      query: { limit: "200", recordId: "r1" },
    });

    const [name, opts] = invoke.mock.calls[0];
    expect(name).toBe("podp-admin?limit=200&recordId=r1");
    expect(opts.method).toBe("GET");
    expect(opts.headers.Authorization).toBe("Bearer t");
  });
});
