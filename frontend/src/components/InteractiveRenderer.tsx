/**
 * InteractiveRenderer — renders interactive HTML content in an iframe.
 */

import { useEffect, useMemo } from "react";

interface InteractiveRendererProps {
  html?: string;
  url?: string;
}

export function InteractiveRenderer({ html, url }: InteractiveRendererProps) {
  const blobUrl = useMemo(() => {
    if (!html) return null;
    const patchedHtml = html.replace(/min-h-screen/g, "min-h-full");
    const blob = new Blob([patchedHtml], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [html]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (blobUrl) {
    return (
      <iframe
        src={blobUrl}
        title="interactive"
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  if (url) {
    return (
      <iframe
        src={url}
        title="interactive"
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      No interactive content available
    </div>
  );
}
