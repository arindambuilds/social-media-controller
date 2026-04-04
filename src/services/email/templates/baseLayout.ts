function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function baseLayout({ subject, previewText, body }: { subject: string; previewText: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
    <style>
      body { margin: 0; padding: 0; background: #f4f7fb; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
      .preheader { display: none; max-height: 0; overflow: hidden; opacity: 0; }
      .shell { padding: 32px 16px; }
      .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 48px rgba(15, 23, 42, 0.08); }
      .header { background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #ffffff; padding: 28px 32px; }
      .header h1 { margin: 0; font-size: 22px; }
      .accent { height: 6px; background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%); }
      .content { padding: 32px; line-height: 1.65; font-size: 15px; }
      .content h2 { margin-top: 0; color: #0f172a; }
      .content p { margin: 0 0 16px; }
      .panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; }
      .button { display: inline-block; background: #f59e0b; color: #111827 !important; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 999px; }
      .muted { color: #475569; font-size: 13px; }
      .footer { padding: 0 32px 32px; color: #64748b; font-size: 12px; }
      .metric-table { width: 100%; border-collapse: collapse; }
      .metric-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
      .metric-table td:first-child { color: #334155; }
      .metric-table td:last-child { text-align: right; font-weight: 700; }
      code { background: #e2e8f0; padding: 2px 4px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="preheader">${escapeHtml(previewText)}</div>
    <div class="shell">
      <div class="card">
        <div class="header">
          <h1>PulseOS</h1>
        </div>
        <div class="accent"></div>
        <div class="content">${body}</div>
        <div class="footer">
          <p>This message was sent by PulseOS.</p>
          <p>If you need help, reply to this email and our team will take a look.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function escapeTemplateHtml(value: string): string {
  return escapeHtml(value);
}
