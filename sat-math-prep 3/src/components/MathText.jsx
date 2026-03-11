"use client";
import { useEffect, useRef } from "react";
import katex from "katex";

// Renders text with inline LaTeX math between $ delimiters
// Example: "Solve $x^2 + 3x = 0$ for x" renders x² + 3x = 0 in math notation
export default function MathText({ text, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !text) return;

    // Split text on $ delimiters — odd segments are math, even are text
    const parts = text.split(/\$(.*?)\$/g);
    ref.current.innerHTML = "";

    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        // Math segment
        const span = document.createElement("span");
        try {
          katex.render(part, span, {
            throwOnError: false,
            displayMode: false,
            output: "html",
          });
        } catch {
          span.textContent = part;
        }
        ref.current.appendChild(span);
      } else {
        // Regular text
        if (part) {
          const textNode = document.createTextNode(part);
          ref.current.appendChild(textNode);
        }
      }
    });
  }, [text]);

  return <span ref={ref} style={{ lineHeight: 1.8, ...style }} />;
}
