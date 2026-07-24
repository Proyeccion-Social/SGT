import { Text } from "react-email";
import type { ReactNode } from "react";

export interface DetailItem {
  label: string;
  value: ReactNode;
}

interface SessionDetailsProps {
  title?: string;
  items: DetailItem[];
}

export default function SessionDetails({ title, items }: SessionDetailsProps) {
  return (
    <div className="mb-[32px] text-left">
      {title && (
        <Text className="m-0 mb-[16px] text-center text-[14px] font-semibold tracking-[-0.02em] text-[#a3a3a3]">
          {title}
        </Text>
      )}
      <table className="w-full" cellPadding="0" cellSpacing="0">
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td
                className={`py-[10px] ${
                  index > 0 ? "border-t border-[#e7dcff]" : ""
                }`}
              >
                <Text className="m-0 mb-[2px] text-[12px] font-semibold uppercase tracking-[0.02em] text-[#a3a3a3]">
                  {item.label}
                </Text>
                <Text className="m-0 text-[15px] leading-[22px] text-[#3c3c3c]">
                  {item.value}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
