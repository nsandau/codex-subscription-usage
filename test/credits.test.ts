import { describe, expect, test } from "bun:test";
import { fetchResetCredits, redeemResetCredit, type ActiveCodexAuth } from "../src/usage";

const auth: ActiveCodexAuth = { provider: "openai-codex", accessToken: "token", accountId: "account" };

describe("reset credits", () => {
  test("lists only available credits ordered by expiry", async () => {
    const credits = await fetchResetCredits(auth, {
      fetch: async () => Response.json({ credits: [
        { id: "later", status: "available", reset_type: "codex_rate_limits", expires_at: 1_800_000_000, title: "Later" },
        { id: "used", status: "redeemed", reset_type: "codex_rate_limits", expires_at: 1_700_000_000 },
        { id: "soon", status: "available", reset_type: "codex_rate_limits", expires_at: 1_700_000_000, title: "Soon" },
      ] }),
    });
    expect(credits.map((credit) => credit.id)).toEqual(["soon", "later"]);
  });

  test("uses the selected credit and supplied idempotency key for redemption", async () => {
    let request: Request | undefined;
    await redeemResetCredit(auth, "credit", "request", {
      fetch: async (input) => {
        request = input instanceof Request ? input : new Request(input);
        return Response.json({ code: "reset", windows_reset: 2 });
      },
    });
    expect(request?.redirect).toBe("error");
    expect(await request?.json()).toEqual({ credit_id: "credit", redeem_request_id: "request" });
  });
});
