const BLOCK_TAG_PATTERN = /<\/?(h\d|p|ul|ol|li|blockquote|pre|code|table|thead|tbody|tr|th|td|hr)\b/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(input: string): string {
  const escaped = escapeHtml(input);

  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  if (BLOCK_TAG_PATTERN.test(markdown)) return markdown;

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraphLines: string[] = [];
  let quoteLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(`<p>${paragraphLines.map(renderInlineMarkdown).join("<br />")}</p>`);
    paragraphLines = [];
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push(`<blockquote><p>${quoteLines.map(renderInlineMarkdown).join("<br />")}</p></blockquote>`);
    quoteLines = [];
  };

  const flushList = () => {
    if (!listType) return;
    blocks.push(`</${listType}>`);
    listType = null;
  };

  const flushCode = () => {
    if (!inCodeBlock) return;
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    inCodeBlock = false;
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      flushQuote();
      flushList();
      if (inCodeBlock) {
        flushCode();
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushQuote();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushQuote();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (line === "---") {
      flushParagraph();
      flushQuote();
      flushList();
      blocks.push("<hr />");
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType !== "ul") {
        flushList();
        blocks.push("<ul>");
        listType = "ul";
      }
      blocks.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType !== "ol") {
        flushList();
        blocks.push("<ol>");
        listType = "ol";
      }
      blocks.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    flushQuote();
    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushQuote();
  flushList();
  flushCode();

  return blocks.join("");
}
