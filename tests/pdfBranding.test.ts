import { describe, expect, it } from "vitest";
import { renderBriefingTemplate } from "../src/templates/reports/briefingTemplate";

describe("briefing report templates", () => {
  it("injects agency branding in generated html", () => {
    const out = renderBriefingTemplate({
      clientName: "Demo Client",
      periodLabel: "Last 30 days",
      latestBriefingText: "Focus on morning reels this week.",
      overview: { totalPosts: 10, totalReach: 1200, avgEngagementRate: 0.067, bestHour: 11 },
      branding: {
        agencyName: "My Agency",
        logoUrl: "https://example.com/logo.png",
        brandColor: "#112233"
      }
    });
    expect(out).toContain("My Agency");
    expect(out).toContain("#112233");
    expect(out).toContain("https://example.com/logo.png");
    expect(out).toContain("Demo Client Growth Report");
  });
});

