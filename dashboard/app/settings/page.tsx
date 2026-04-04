"use client";

import { Check, Copy, Info, Pencil, ShieldAlert, Trash2, User, Smartphone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/cn";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { formatPlanLabel } from "../../lib/pulse";
import { getBranding, getClientProfile, getDmSettings, saveBranding, updateAccount, updateClientProfile, updateDmSettings, uploadBrandLogo } from "../../lib/workspace";

function passwordStrength(password: string) {
  if (password.length < 8) return { label: "Weak", width: "33%", color: "var(--danger)" };
  if (/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return { label: "Strong", width: "100%", color: "var(--success)" };
  return { label: "Medium", width: "66%", color: "var(--amber)" };
}

function DeleteLockIcon({ unlocked }: { unlocked: boolean }) {
  return (
    <svg className={cn("delete-lock-svg", unlocked && "is-unlocked")} width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <g className="delete-lock-shackle" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      </g>
      <rect x="5" y="11" width="14" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function SettingsPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated, refreshUser } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCheck, setDeleteCheck] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [businessContext, setBusinessContext] = useState("");
  const [brandColor, setBrandColor] = useState("#C8A951");
  const [agencyName, setAgencyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [securityValues, setSecurityValues] = useState({ current: "", next: "", confirm: "" });

  usePageTitle("Settings");

  const strength = useMemo(() => passwordStrength(securityValues.next), [securityValues.next]);

  const loadSettings = useCallback(async () => {
    if (!user?.clientId) {
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
      setLoading(false);
      return;
    }

    try {
      const [profile, dmSettings, branding] = await Promise.all([
        getClientProfile(user.clientId),
        getDmSettings(user.clientId),
        getBranding().catch(() => ({ agencyName: "", brandColor: "#C8A951", logoUrl: null }))
      ]);
      setName(user.name ?? profile.name ?? "");
      setEmail(user.email ?? "");
      setBusinessType(profile.businessType ?? "");
      setWhatsappNumber(dmSettings.whatsappNumber ?? profile.whatsappNumber ?? "");
      setAutoReplyEnabled(dmSettings.dmAutoReplyEnabled);
      setBusinessContext(dmSettings.dmBusinessContext ?? "");
      setBrandColor(branding.brandColor ?? "#C8A951");
      setAgencyName(branding.agencyName ?? "");
      setLogoUrl(branding.logoUrl ?? "");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t load settings.");
    } finally {
      setLoading(false);
    }
  }, [toast, user?.clientId, user?.email, user?.name]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    void loadSettings();
  }, [isAuthenticated, isReady, loadSettings]);

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await updateAccount({ name, email });
      if (user?.clientId) {
        await updateClientProfile(user.clientId, { name, businessType, whatsappNumber });
      }
      await refreshUser();
      setEditingProfile(false);
      toast.success("Save ✓", "Your account details are updated.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t save account details.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveConfig() {
    if (!user?.clientId) return;
    setSavingConfig(true);
    try {
      await updateDmSettings(user.clientId, {
        dmAutoReplyEnabled: autoReplyEnabled,
        dmBusinessContext: businessContext,
        whatsappNumber
      });
      toast.success("Save ✓", "Your WhatsApp settings are updated.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t save WhatsApp settings.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSaveBrand() {
    setSavingBrand(true);
    try {
      await saveBranding({ agencyName, brandColor, logoUrl: logoUrl || null });
      toast.success("Save ✓", "Your branding is ready for the next PDF.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t save branding.");
    } finally {
      setSavingBrand(false);
    }
  }

  async function handleUploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await uploadBrandLogo(formData);
      setLogoUrl(response.url);
      toast.success("Done! ✓", "Logo uploaded and ready to use.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t upload the logo.");
    }
  }

  async function handleCopy() {
    if (!whatsappNumber) return;
    await navigator.clipboard.writeText(whatsappNumber);
    setCopied(true);
    toast.success("Copied! ✓", "Your WhatsApp number is on the clipboard.");
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleSecuritySubmit() {
    toast.info("Secure password tools are almost here", "The UI is ready — we’ll connect the password update endpoint next.");
  }

  return (
    <section key={pathname} className={`page-section overview-grid ${pageClassName}`}>
      <div className="settings-grid">
        <Card className="settings-section-card" style={{ gridColumn: "span 3" }}>
          <div className="section-heading">
            <div>
              <h2><User size={18} style={{ marginRight: 8 }} /> Account Details</h2>
              <p>Calm, clear, and easy to change when your business grows.</p>
            </div>
            {!editingProfile ? <Button variant="ghost" onClick={() => setEditingProfile(true)}><Pencil size={16} /> Edit</Button> : null}
          </div>

          {loading ? <Skeleton className="h-[180px]" /> : (
            <>
              <div className="settings-field-row">
                <div className="settings-field-copy">
                  <strong>Name</strong>
                  <p>{editingProfile ? "" : name || "Add your name"}</p>
                </div>
                {editingProfile ? <div style={{ width: "min(320px, 100%)" }}><Input label="Name" value={name} onChange={(event) => setName(event.target.value)} /></div> : null}
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy">
                  <strong>Email</strong>
                  <p>{editingProfile ? "" : email}</p>
                </div>
                {editingProfile ? <div style={{ width: "min(320px, 100%)" }}><Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div> : null}
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy">
                  <strong>Business Type</strong>
                  <p>{editingProfile ? "" : businessType || "Tell us what kind of business you run."}</p>
                </div>
                {editingProfile ? <div style={{ width: "min(320px, 100%)" }}><Input label="Business Type" value={businessType} onChange={(event) => setBusinessType(event.target.value)} /></div> : null}
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy">
                  <strong>Plan</strong>
                  <p><Link href="/billing"><Badge tone="amber">{formatPlanLabel(user?.plan)} Plan</Badge></Link></p>
                </div>
                <Badge tone="green">Complete ✓</Badge>
              </div>
              {editingProfile ? <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 18 }}><Button variant="ghost" onClick={() => setEditingProfile(false)}>Cancel</Button><Button variant="primary" loading={savingProfile} onClick={handleSaveProfile}>Save ✓</Button></div> : null}
            </>
          )}
        </Card>

        <Card className="settings-section-card" style={{ gridColumn: "span 3" }}>
          <div className="section-heading">
            <div>
              <h2><Smartphone size={18} style={{ marginRight: 8 }} /> WhatsApp Configuration</h2>
              <p>Everything important in one trustworthy section.</p>
            </div>
            <Badge tone={autoReplyEnabled ? "green" : "red"}>{autoReplyEnabled ? "Active" : "Inactive"}</Badge>
          </div>

          {loading ? <Skeleton className="h-[200px]" /> : (
            <>
              <div className="info-banner" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <Info size={18} aria-hidden /> PulseOS keeps your business reachable even when your day gets busy.
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy">
                  <strong>Phone Number</strong>
                  <p style={{ fontFamily: "var(--font-display)" }}>{whatsappNumber || "Add your WhatsApp business number"}</p>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Button variant="ghost" onClick={handleCopy}><Copy size={16} /> Copy</Button>
                  {copied ? <span className="copy-badge"><Check size={14} /> Copied! ✓</span> : null}
                </div>
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy" style={{ flex: 1 }}>
                  <strong>WhatsApp Number</strong>
                  <p>Use your full number with country code.</p>
                </div>
                <div style={{ width: "min(360px, 100%)" }}><Input label="WhatsApp Number" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} /></div>
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy" style={{ flex: 1 }}>
                  <strong>Auto reply</strong>
                  <p>Turn on helpful, steady replies when customers message in.</p>
                </div>
                <Button variant={autoReplyEnabled ? "primary" : "outline"} onClick={() => setAutoReplyEnabled((current) => !current)}>
                  {autoReplyEnabled ? "Enabled" : "Enable"}
                </Button>
              </div>
              <div className="settings-field-row" style={{ alignItems: "flex-start" }}>
                <div className="settings-field-copy" style={{ flex: 1 }}>
                  <strong>Business Context</strong>
                  <p>Share a little about your shop so the AI sounds like you.</p>
                </div>
                <div style={{ width: "min(420px, 100%)" }}><Input label="Business Context" value={businessContext} onChange={(event) => setBusinessContext(event.target.value)} /></div>
              </div>
              {!autoReplyEnabled ? <div className="warning-banner" style={{ marginTop: 16 }}>Auto replies are currently off, so customers may wait longer than usual.</div> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><Button variant="primary" loading={savingConfig} onClick={handleSaveConfig}>Save ✓</Button></div>
            </>
          )}
        </Card>

        <Card className="settings-section-card" style={{ gridColumn: "span 3" }}>
          <div className="section-heading">
            <div>
              <h2>Branding</h2>
              <p>Your reports should feel like they came straight from your business.</p>
            </div>
            <Badge tone="amber">PDF-ready</Badge>
          </div>
          {loading ? <Skeleton className="h-[180px]" /> : (
            <>
              <div className="settings-field-row">
                <div className="settings-field-copy" style={{ flex: 1 }}>
                  <strong>Agency or Business Name</strong>
                  <p>This appears on branded PDF exports.</p>
                </div>
                <div style={{ width: "min(360px, 100%)" }}><Input label="Business Name" value={agencyName} onChange={(event) => setAgencyName(event.target.value)} /></div>
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy" style={{ flex: 1 }}>
                  <strong>Brand Color</strong>
                  <p>Choose the accent color that feels most like your business.</p>
                </div>
                <input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} style={{ width: 54, height: 42, border: 0, background: "transparent" }} />
              </div>
              <div className="settings-field-row">
                <div className="settings-field-copy" style={{ flex: 1 }}>
                  <strong>Logo</strong>
                  <p>{logoUrl || "Upload a logo or paste a public image URL."}</p>
                </div>
                <div style={{ width: "min(360px, 100%)", display: "grid", gap: 12 }}>
                  <Input label="Logo URL" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
                  <input type="file" accept="image/*" onChange={handleUploadLogo} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><Button variant="primary" loading={savingBrand} onClick={handleSaveBrand}>Save ✓</Button></div>
            </>
          )}
        </Card>

        <Card className="settings-section-card" style={{ gridColumn: "span 2" }}>
          <div className="section-heading">
            <div>
              <h2>Security</h2>
              <p>Helpful, calm password tools with a clear strength guide.</p>
            </div>
            <Badge tone="navy">Protected</Badge>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <Input label="Current Password" type="password" value={securityValues.current} onChange={(event) => setSecurityValues((current) => ({ ...current, current: event.target.value }))} />
            <div>
              <Input label="New Password" type="password" value={securityValues.next} onChange={(event) => setSecurityValues((current) => ({ ...current, next: event.target.value }))} />
              <div className="password-strength"><div className="password-strength-bar" style={{ width: strength.width, backgroundColor: strength.color }} /></div>
              <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>{strength.label}</p>
            </div>
            <Input label="Confirm New Password" type="password" value={securityValues.confirm} onChange={(event) => setSecurityValues((current) => ({ ...current, confirm: event.target.value }))} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}><Button variant="primary" onClick={handleSecuritySubmit}>Save ✓</Button></div>
          </div>
        </Card>

        <Card className="settings-section-card" style={{ gridColumn: "span 1" }}>
          <div className="danger-zone">
            <div className="section-heading" style={{ marginBottom: 10 }}>
              <div>
                <h3>Danger Zone</h3>
                <p>Thoughtful guardrails before any destructive action.</p>
              </div>
              <ShieldAlert size={18} aria-hidden />
            </div>
            <Button variant="danger" fullWidth onClick={() => setDeleteModalOpen(true)}>
              <Trash2 size={16} /> Delete Account
            </Button>
          </div>
        </Card>
      </div>

      {deleteModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-account-modal-title">
          <div className="modal-card is-open">
            <div>
              <h3 id="delete-account-modal-title">Delete account</h3>
              <p>Type DELETE (case-sensitive) to unlock the button. This keeps accidental taps from causing real damage.</p>
            </div>
            <div style={{ marginTop: 18 }}>
              <Input label="Type DELETE" value={deleteCheck} onChange={(event) => setDeleteCheck(event.target.value)} autoComplete="off" />
            </div>
            <div className="modal-actions delete-danger-modal-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteCheck("");
                }}
              >
                Cancel
              </Button>
              <div className="delete-confirm-with-lock">
                <DeleteLockIcon unlocked={deleteCheck === "DELETE"} />
                <Button
                  variant="danger"
                  className="delete-account-confirm-btn"
                  disabled={deleteCheck !== "DELETE"}
                  onClick={() => {
                    toast.warning("Deletion needs a final support check", "We’ll wire the final secure delete flow next.");
                    setDeleteModalOpen(false);
                    setDeleteCheck("");
                  }}
                >
                  Delete account
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

