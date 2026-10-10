import { useTranslations } from "next-intl";
import { contactLinks, site } from "@/content/site";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="mt-auto border-t border-line/70">
      <div className="container-page flex flex-col gap-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}
          <br />
          {t("builtWith")}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {contactLinks.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                target={link.id === "email" ? undefined : "_blank"}
                rel="noreferrer"
                className="link-underline hover:text-ink"
              >
                {link.label}
                {link.id !== "email" && <span aria-hidden="true"> ↗</span>}
              </a>
            </li>
          ))}
          {site.sourceRepo && (
            <li>
              <a
                href={site.sourceRepo}
                target="_blank"
                rel="noreferrer"
                className="link-underline hover:text-ink"
              >
                {t("source")}
                <span aria-hidden="true"> ↗</span>
              </a>
            </li>
          )}
        </ul>
      </div>
    </footer>
  );
}
