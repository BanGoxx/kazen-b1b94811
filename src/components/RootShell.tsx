import { HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

const THEME_INIT = `(function(){try{var t=localStorage.getItem('nexus-theme');if(t==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

/**
 * Document shell (html/head/body) for every route.
 *
 * Kept in its own module — NOT inline in __root.tsx — on purpose: TanStack
 * Start's route code-splitter rewrites __root.tsx differently for the server
 * and client bundles, which shifts source line numbers. The Lovable dev
 * component tagger writes those line numbers into data-tsd-source, so an inline
 * shell produced mismatched attributes on <html> and crashed hydration in the
 * dev preview. A standalone module is transformed identically in both bundles.
 */
export function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Apply saved theme before first paint to avoid a light/dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
