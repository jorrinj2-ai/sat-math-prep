import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata = {
  title: "SAT Math Prep",
  description: "SAT Math practice exams with scoring and progress tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
