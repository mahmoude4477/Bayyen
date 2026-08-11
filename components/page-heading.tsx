import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="page-heading">
      <div>
        {backHref && <Link className="back-link" href={backHref}>{backLabel ?? "رجوع"}<ChevronLeft size={15} /></Link>}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
