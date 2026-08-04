import { Section, Text } from "react-email";
import type { ReactNode } from "react";

interface AlertBannerProps {
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "error";
}

const variantStyles = {
  info: "bg-[#f3edff] text-[#8751ff]",
  success: "bg-[#d5f5e3] text-[#25a35a]",
  warning: "bg-[#fcf4db] text-[#c2a13d]",
  error: "bg-[#fcd5d8] text-[#c0242e]",
};

export default function AlertBanner({
  children,
  variant = "info",
}: AlertBannerProps) {
  return (
    <Section
      className={`mb-[32px] rounded-[8px] px-[20px] py-[16px] text-center ${variantStyles[variant]}`}
    >
      <Text className="m-0 text-[14px] font-semibold leading-[20px]">
        {children}
      </Text>
    </Section>
  );
}
