# Technical Architecture Summary (Non-Technical)  
## PulseOS — Security, Scale, and Data Privacy

**Document type:** One-page briefing · **Audience:** Senior administrative officers, policy reviewers, grant panels  
**Note:** Descriptions below avoid implementation jargon; technical detail is available under separate engineering annex if required.

---

### 1. What the system is

The solution is a **web-based application** in two parts: (i) a **secure server** (“backend”) that stores business and analytics data and talks to Instagram through **official, authorised channels** where configured; and (ii) a **browser dashboard** (“frontend”) that owners and authorised staff use on a phone or computer. A **demonstration mode** exists that does not require live Instagram approval—useful for training and early showcases.

### 2. Security posture (audit-aligned)

An internal **pre-launch security review** has been conducted and remediated for the application programming interface (API). In plain terms:

- **Access control:** Users sign in with **encrypted passwords**; sessions use **industry-standard tokens** with **short lifetimes** in production, reducing harm if a device is lost.  
- **Network safety:** The service uses **HTTPS** (encrypted traffic), **strict browser security headers**, and **controlled cross-origin access** so only approved websites may call the API in production.  
- **Abuse prevention:** **Rate limits** apply to login and registration to reduce password-guessing and bulk account creation.  
- **Error handling:** In production, **detailed technical errors are not shown to end users**, reducing information leakage; issues are logged securely for operators.  
- **Ongoing risk (declared):** Dashboard tokens currently sit in the browser storage—acceptable for pilot scale; **migration to more secure cookie-based sessions** is planned as usage grows.

*Reference (internal): `SECURITY_AUDIT_REPORT.md`.*

### 3. Scalability (realistic)

The architecture is **modular**: the database, application server, and optional **background job** layer can be scaled independently. For the **500-MSME pilot**, a single professionally hosted deployment with a **managed database** and **managed cache/queue** service is sufficient if **operational discipline** (monitoring, backups, environment configuration) is maintained. Growth toward **thousands** of businesses would follow a **staged** path—additional capacity, read optimisation, and stronger session security—not a full rebuild.

### 4. Data privacy and compliance (principles)

- **Role of the platform:** **Processor / operator** of data provided by users for the purpose of analytics and assistance; **not** a substitute for statutory filings or government records.  
- **Minimisation:** Only data needed for Instagram analytics, insights, and support is retained; social tokens are **encrypted at rest** where implemented.  
- **Tenant isolation:** Business users are **scoped** to their own organisation’s data; administrative roles are **logged and limited** by design.  
- **Consent:** Pilot onboarding requires **clear consent** for participation and for **aggregate** reporting; identifiable stories or quotes require **separate permission**.  
- **Subprocessors:** Hosting (e.g. cloud providers), database, optional error-monitoring, and—if enabled—AI inference providers must be **listed in a transparency annex** and kept on **Indian or approved jurisdictions** as per scheme rules.

### 5. Reliance statement

This summary reflects **good-faith technical practice** appropriate for a **pilot-stage** digital public-purpose deployment. It does **not** constitute a statutory compliance certificate; **DPDP Act** and scheme-specific requirements should be reviewed by legal counsel before final obligation.

---

*Engineering evidence: repository documentation map, `docs/pilot-operational-readiness.md`, `docs/completion-report.md`.*
