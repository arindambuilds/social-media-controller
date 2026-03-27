import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="dash-page-header">
      <div className="dash-page-header-text">
        {eyebrow ? <p className="dash-eyebrow">{eyebrow}</p> : null}
        <h1 className="dash-page-title">{title}</h1>
        {description ? <p className="dash-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="dash-page-header-actions">{actions}</div> : null}
    </header>
  );
}
