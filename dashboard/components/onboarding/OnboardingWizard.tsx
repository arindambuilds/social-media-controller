"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { ProgressBar } from "../ui/progress-bar";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/cn";
import { apiFetch } from "../../lib/api";

type Step = 1 | 2 | 3;

type User = {
  id: string;
  onboardingCompleted: boolean;
  clientId?: string;
};

type Conversation = {
  id: string;
  senderName: string;
  lastMessage: string;
  createdAt: string;
};

type Props = {
  user: User;
  onComplete: () => void;
};

export function OnboardingWizard({ user, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoConversations, setDemoConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (currentStep === 2) {
      fetchDemoConversations();
    }
  }, [currentStep]);

  const fetchDemoConversations = async () => {
    if (!user.clientId) return;
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>(
        `/conversations?clientId=${user.clientId}&limit=3`
      );
      setDemoConversations(data.conversations || []);
    } catch (error) {
      console.error("Failed to fetch demo conversations", error);
    }
  };

  const handleStep1Next = async () => {
    if (!businessName.trim() || !businessType) return;
    setLoading(true);
    try {
      await apiFetch("/onboarding/step1", {
        method: "POST",
        body: JSON.stringify({ businessName, businessType }),
      });
      setCurrentStep(2);
    } catch (error) {
      console.error("Step 1 failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = async () => {
    setLoading(true);
    try {
      await apiFetch("/onboarding/step2", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setCurrentStep(3);
    } catch (error) {
      console.error("Step 2 failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Complete = async (action: "connect" | "explore") => {
    setLoading(true);
    try {
      await apiFetch("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (action === "connect") {
        window.location.href = "/settings#whatsapp";
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Complete failed", error);
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / 3) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface rounded-2xl shadow-2xl border border-line">
        <div className="p-6">
          <div className="mb-6">
            <ProgressBar value={progress} max={100} />
            <div className="flex justify-between mt-2 text-sm text-muted">
              <span>Step {currentStep} of 3</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-ink mb-2">
                  Tell us about your business
                </h2>
                <p className="text-muted">
                  This helps us personalize your PulseOS experience.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Input
                    label="Business Name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. My Awesome Business"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Business Type
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3 py-2 bg-depth border border-line rounded-lg text-ink"
                  >
                    <option value="">Select type</option>
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Restaurant/Food">Restaurant/Food</option>
                    <option value="Salon/Spa">Salon/Spa</option>
                    <option value="Clinic/Medical">Clinic/Medical</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Education/Coaching">Education/Coaching</option>
                    <option value="Clothing/Fashion">Clothing/Fashion</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleStep1Next}
                  disabled={!businessName.trim() || !businessType || loading}
                  loading={loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-ink mb-2">
                  This is what PulseOS looks like when it's working
                </h2>
                <p className="text-muted">
                  These are sample conversations from your demo data.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-accent-teal">5</div>
                    <div className="text-sm text-muted">conversations</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-mango-500">78%</div>
                    <div className="text-sm text-muted">reply rate</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-ocean-400">4.2m</div>
                    <div className="text-sm text-muted">avg response</div>
                  </Card>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="green">AI replied to 3 of these automatically</Badge>
                </div>
                <div className="space-y-2">
                  {demoConversations.map((conv) => (
                    <Card key={conv.id} className="p-4">
                      <div className="font-medium text-ink">{conv.senderName}</div>
                      <div className="text-sm text-muted truncate">{conv.lastMessage}</div>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleStep2Next} loading={loading}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-ink mb-2">
                  Connect your WhatsApp to go live
                </h2>
                <p className="text-muted">
                  Choose how you'd like to proceed.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  className="p-6 cursor-pointer hover:shadow-glow transition-shadow"
                  onClick={() => handleStep3Complete("connect")}
                >
                  <h3 className="font-semibold text-ink mb-2">Connect WhatsApp Now</h3>
                  <p className="text-sm text-muted mb-4">
                    Set up your WhatsApp Business API to start receiving real messages.
                  </p>
                  <Badge>Takes 2 minutes</Badge>
                </Card>
                <Card
                  className="p-6 cursor-pointer hover:shadow-teal transition-shadow"
                  onClick={() => handleStep3Complete("explore")}
                >
                  <h3 className="font-semibold text-ink mb-2">Explore the demo first</h3>
                  <p className="text-sm text-muted mb-4">
                    Check out the dashboard with sample data before connecting.
                  </p>
                  <Badge tone="soft">No setup needed</Badge>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
