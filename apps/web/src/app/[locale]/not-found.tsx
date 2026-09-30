import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <section className="container-page py-32 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-display text-4xl tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-muted">{t("description")}</p>
      <Link href="/" className="btn btn-primary mt-10">
        {t("back")}
      </Link>
    </section>
  );
}
