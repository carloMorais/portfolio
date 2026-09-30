import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "@/i18n/routing";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";

const messages = { en, pt } as const;

export function renderWithIntl(ui: ReactElement, locale: Locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}
