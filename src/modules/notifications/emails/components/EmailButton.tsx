import { Button } from "react-email";
import type { ReactNode } from "react";

interface EmailButtonProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export default function EmailButton({
  href,
  children,
  variant = "primary",
}: EmailButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Button
      href={href}
      className={`inline-block rounded-[8px] px-[28px] py-[14px] text-[15px] font-bold no-underline ${
        isPrimary
          ? "bg-[#9f74ff] text-white"
          : "bg-[#c1ff72] text-[#1a1a1a]"
      }`}
    >
      {children}
    </Button>
  );
}
