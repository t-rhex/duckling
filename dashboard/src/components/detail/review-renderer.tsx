"use client";

import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

interface ReviewRendererProps {
  content: string;
}

export function ReviewRenderer({ content }: ReviewRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert prose-headings:font-semibold prose-h2:text-lg prose-h2:border-b prose-h2:pb-2 prose-code:text-amber-500 prose-pre:bg-zinc-900 max-w-none px-1 py-2">
      <Markdown rehypePlugins={[rehypeHighlight]}>
        {content}
      </Markdown>
    </div>
  );
}
