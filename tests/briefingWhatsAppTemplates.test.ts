import { describe, expect, it } from "vitest";
import { buildWhatsAppBriefingBody } from "../src/services/briefingDelivery";
import type { BriefingData } from "../src/services/briefingData";

const baseData: BriefingData = {
  businessName: "Test Biz",
  ownerName: "A",
  newFollowers: 2,
  totalFollowers: 100,
  newLeads: 3,
  likesYesterday: 10,
  commentsYesterday: 4,
  topPost: null,
  scheduledToday: 1
};

describe("buildWhatsAppBriefingBody tier templates", () => {
  it("normal omits week trend block", () => {
    const body = buildWhatsAppBriefingBody(baseData, "Keep posting.", "normal");
    expect(body).toContain("YESTERDAY");
    expect(body).not.toContain("WEEK TREND");
  });

  it("standard includes week trend when aggregates exist", () => {
    const body = buildWhatsAppBriefingBody(
      { ...baseData, leadsLast7d: 10, leadsPrev7d: 5 },
      "Tip.",
      "standard"
    );
    expect(body).toContain("WEEK TREND");
    expect(body).toContain("prior 7d");
  });

  it("elite can show 7d follower net and alert line", () => {
    const body = buildWhatsAppBriefingBody(
      { ...baseData, leadsLast7d: 8, leadsPrev7d: 8, followersNet7d: 12 },
      "Tip.",
      "elite",
      { eliteAlertLine: "⚠️ Test alert" }
    );
    expect(body).toContain("Followers (7d net)");
    expect(body).toContain("⚠️ Test alert");
  });
});
