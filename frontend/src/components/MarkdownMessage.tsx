"use client";

import React from "react";

/**
 * Simple markdown renderer for Claude responses.
 * Handles: **bold**, *italic*, `code`, bullet lists (- / •), numbered lists,
 * and headings (#/##/###).
 * Bold segments are rendered with a violet highlight for visibility.
 */
export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        // Heading 1
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold text-white mt-2">{renderInline(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-white mt-2">{renderInline(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-white mt-2">{renderInline(line.slice(2))}</h1>;

        // Bullet list
        if (line.match(/^[-•*]\s/)) {
          return (
            <div key={i} className="flex gap-2 items-start pl-2">
              <span className="text-violet-400 mt-0.5 shrink-0">•</span>
              <span className="text-gray-200">{renderInline(line.replace(/^[-•*]\s/, ""))}</span>
            </div>
          );
        }

        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2 items-start pl-2">
              <span className="text-violet-400 shrink-0 font-mono text-xs mt-0.5">{num}.</span>
              <span className="text-gray-200">{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }

        // Horizontal rule
        if (line.match(/^---+$/)) return <hr key={i} className="border-[#1f1f2e] my-2" />;

        // Empty line → spacing
        if (line.trim() === "") return <div key={i} className="h-1" />;

        // Normal paragraph
        return (
          <p key={i} className="text-gray-200">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
  // Split on bold (**text**), italic (*text*), code (`text`)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    // Bold → violet highlight
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return (
        <strong key={i} className="font-semibold text-white bg-violet-600/20 rounded px-0.5">
          {inner}
        </strong>
      );
    }
    // Italic
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-gray-300">{part.slice(1, -1)}</em>;
    }
    // Inline code
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="text-xs font-mono bg-[#1a1a2e] border border-[#1f1f2e] rounded px-1 py-0.5 text-violet-300">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
