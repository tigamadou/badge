import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeCustomRole, makeOrg, makePlan, makePayment, makeStaff, makeUser } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/platform/organizations/x",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
import { getServerSession } from "next-auth";
import OrgActivitySupervisionPage from "../activity/page";
import OrgSubscriptionPage from "../subscription/page";
import PlatformOrgLayout from "../layout";

function as(userId: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId } } as never);
}

async function limitedStaff(permissions: Parameters<typeof makeCustomRole>[0]["permissions"]) {
  const role = await makeCustomRole({ scope: "PLATFORM", permissions });
  return makeUser({ isStaff: true, platformRoleId: role.id });
}

describe("supervision d'une organisation : gardes par ressource", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("le journal exige activity.read", async () => {
    const org = await makeOrg();
    const u = await limitedStaff(["platform.access", "organizations.read"]);
    as(u.id);
    await expect(
      OrgActivitySupervisionPage({ params: Promise.resolve({ orgId: org.id }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/platform");
    const ok = await makeStaff("STAFF_OBSERVER");
    as(ok.id);
    await expect(
      OrgActivitySupervisionPage({ params: Promise.resolve({ orgId: org.id }), searchParams: Promise.resolve({}) }),
    ).resolves.toBeTruthy();
  });

  it("l'abonnement masque l'historique des paiements sans payments.read", async () => {
    const org = await makeOrg();
    await makePayment(org.id, { planId: (await makePlan()).id });
    const u = await limitedStaff(["platform.access", "organizations.read"]);
    as(u.id);
    const without = renderToStaticMarkup(await OrgSubscriptionPage({ params: Promise.resolve({ orgId: org.id }) }));
    expect(without).not.toContain("Historique des paiements");
    const admin = await makeStaff("STAFF_OBSERVER");
    as(admin.id);
    const withPay = renderToStaticMarkup(await OrgSubscriptionPage({ params: Promise.resolve({ orgId: org.id }) }));
    expect(withPay).toContain("Historique des paiements");
  });

  it("le layout n'affiche l'onglet Journal qu'avec activity.read", async () => {
    const org = await makeOrg();
    const u = await limitedStaff(["platform.access", "organizations.read"]);
    as(u.id);
    const render = async () =>
      renderToStaticMarkup(await PlatformOrgLayout({ params: Promise.resolve({ orgId: org.id }), children: null }));
    expect(await render()).not.toContain(">Journal<");
    const ok = await makeStaff("STAFF_OBSERVER");
    as(ok.id);
    expect(await render()).toContain(">Journal<");
  });
});
