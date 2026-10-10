/**
 * A script that runs as the HTML is parsed, before the first paint. React
 * renders it as text/plain on the client, so it never runs twice and never
 * warns; suppressHydrationWarning accepts the difference. The pattern is
 * Next's own (docs: preventing flash before hydration).
 */
export function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
