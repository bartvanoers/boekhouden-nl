"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wrapper rond de next-themes-provider. Zet de `.dark`-class op <html> op
 * basis van de gekozen modus (licht / donker / systeem).
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
