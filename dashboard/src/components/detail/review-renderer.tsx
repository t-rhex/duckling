"use client";

import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

interface ReviewRendererProps {
  content: string;
}

export function ReviewRenderer({ content }: ReviewRendererProps) {
  return (
    <div
      className={[
        "prose-duckling",
        "prose prose-sm dark:prose-invert max-w-none px-1 py-2",
        "prose-headings:font-semibold",
        "prose-h2:border-b prose-h2:border-[rgba(251,191,36,0.1)] prose-h2:pb-2 prose-h2:text-lg",
        "prose-h3:text-base",
        "prose-code:text-[var(--duckling-amber)] prose-code:font-mono prose-code:text-sm",
        "prose-pre:rounded-lg prose-pre:border prose-pre:border-[rgba(251,191,36,0.1)] prose-pre:bg-[#0C0A09]",
        "prose-a:text-[var(--duckling-amber)] prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-foreground",
        "prose-p:text-muted-foreground prose-p:leading-relaxed",
        "prose-li:text-muted-foreground",
        "prose-blockquote:border-l-[var(--duckling-amber-muted)] prose-blockquote:text-muted-foreground",
      ].join(" ")}
    >
      <Markdown rehypePlugins={[rehypeHighlight]}>{content}</Markdown>
    </div>
  );
}
