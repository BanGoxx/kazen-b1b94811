import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";

const LOCALE_LABELS: Record<Locale, { native: string; short: string }> = {
  fr: { native: "Français", short: "FR" },
  en: { native: "English", short: "EN" },
};

/**
 * Accessible language selector. Keyboard-navigable dropdown, explicit
 * `aria-label`, current locale surfaced both visually (short code) and via
 * screen-reader-only text.
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const current = LOCALE_LABELS[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2"
          aria-label={`${t.common.languageLabel} : ${current.native}`}
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wide">
            {current.short}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t.common.languageLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => setLocale(code)}
              className="flex items-center justify-between gap-2"
              aria-current={active ? "true" : undefined}
            >
              <span>{LOCALE_LABELS[code].native}</span>
              {active ? (
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
