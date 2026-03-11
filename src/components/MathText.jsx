"use client";
import { useEffect, useRef } from "react";
import katex from "katex";

// Renders text with LaTeX math between $ delimiters
// 
// KEY BEHAVIOR:
// - Lines that are ONLY math ($...$) render as centered display-mode blocks
// - Multiple consecutive math-only lines stack vertically (for systems of equations)
// - Text lines with embedded $...$ render inline math within the text
// - Blank lines between math block and text create visual separation
//
// Example input for a system of equations question:
//   "$y - 9x = 13$\n$5x = 2y$\n\nWhat is the solution $(x, y)$?"
// Renders as:
//   [centered]  y - 9x = 13
//   [centered]  5x = 2y
//   [gap]
//   What is the solution (x, y)?

export default function MathText({ text, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !text) return;
    ref.current.innerHTML = "";

    // Normalize newlines - handle both literal \n in JSON and actual newlines
    const normalized = String(text).replace(/\\n/g, "\n");
    const lines = normalized.split("\n");

    // Group lines: math blocks (standalone $...$) vs text
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();

      // Empty line = spacer
      if (!trimmed) {
        const spacer = document.createElement("div");
        spacer.style.height = "8px";
        ref.current.appendChild(spacer);
        i++;
        continue;
      }

      // Check if this is a standalone math line
      if (isMathLine(trimmed)) {
        // Collect consecutive math lines into a system block
        const mathBlock = document.createElement("div");
        mathBlock.style.textAlign = "center";
        mathBlock.style.margin = "10px 0";

        while (i < lines.length && isMathLine(lines[i].trim())) {
          const mathContent = lines[i].trim().slice(1, -1); // remove $ $
          const eqDiv = document.createElement("div");
          eqDiv.style.margin = "4px 0";
          try {
            katex.render(mathContent, eqDiv, {
              throwOnError: false,
              displayMode: true,
              output: "html",
            });
          } catch {
            eqDiv.textContent = mathContent;
          }
          mathBlock.appendChild(eqDiv);
          i++;
        }

        ref.current.appendChild(mathBlock);
        continue;
      }

      // Regular text line with possible inline math
      const p = document.createElement("span");
      renderInlineMath(trimmed, p);
      ref.current.appendChild(p);
      i++;
    }
  }, [text]);

  return <span ref={ref} style={{ lineHeight: 1.9, ...style }} />;
}

// Check if a trimmed line is purely a math expression: starts and ends with $
function isMathLine(trimmed) {
  if (!trimmed || trimmed.length < 3) return false;
  if (trimmed[0] !== "$") return false;
  // Find the closing $ - it should be the last character
  const lastDollar = trimmed.lastIndexOf("$");
  if (lastDollar <= 0) return false;
  // The line should start with $ and end with $, with no other text outside
  // But there could be multiple $...$ pairs inline, so check if it's ONE expression
  if (trimmed[trimmed.length - 1] !== "$") return false;
  // Count $ signs - if exactly 2, it's a standalone expression
  const dollarCount = (trimmed.match(/\$/g) || []).length;
  if (dollarCount === 2) return true;
  return false;
}

// Render a text line that may contain inline $...$ math expressions
function renderInlineMath(text, container) {
  const parts = text.split(/\$(.*?)\$/g);
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
      container.appendChild(span);
    } else {
      if (part) {
        container.appendChild(document.createTextNode(part));
      }
    }
  });
}
