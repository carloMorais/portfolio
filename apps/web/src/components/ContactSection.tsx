import { useTranslations } from "next-intl";
import { contactLinks, site } from "@/content/site";
import { brushTags } from "@/lib/rich";
import { CvDownloadLink } from "./CvDownloadLink";
import { PinIcon } from "./icons";
import { PhotoSlot } from "./PhotoSlot";
import { SectionHeader } from "./SectionHeader";

export function ContactSection() {
  const t = useTranslations("Home");

  return (
    <section id="contact" className="scroll-mt-16 bg-surface/60">
      <div className="container-page grid items-center gap-12 py-20 md:grid-cols-[22rem_1fr] md:gap-16 md:py-28">
        <PhotoSlot
          id="contactPortrait"
          sizes="22rem"
          className="order-last max-w-sm md:order-none md:max-w-none"
        />
        <div className="reveal">
          <SectionHeader title={t.rich("contactTitle", brushTags)} lead={t("contactLead")} />
          <a
            href={`mailto:${site.email}`}
            className="link-underline mt-8 inline-block font-display text-2xl break-all sm:text-3xl"
          >
            {site.email}
          </a>
          <ul className="mt-8 flex flex-wrap gap-3">
            {contactLinks
              .filter((link) => link.id !== "email")
              .map((link) => (
                <li key={link.id}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    {link.label} <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            <li>
              <CvDownloadLink />
            </li>
          </ul>
          <p className="mt-8 flex items-center gap-1.5 text-sm text-muted">
            <PinIcon className="size-4" />
            {t("location")}
          </p>
        </div>
      </div>
    </section>
  );
}
