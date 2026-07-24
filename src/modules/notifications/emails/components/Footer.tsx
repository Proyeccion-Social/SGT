import { Section, Img, Text, Row, Column, Link, Tailwind } from "react-email";
import { WhatsApp } from "../icons/WhatsApp";
import { Instagram } from "../icons/Instagram";

export default function Footer() {
  return (
    <Tailwind>
      <Section className="text-center px-[32px] py-[40px] max-sm:px-[24px] max-sm:py-[32px]">
        <table className="w-full">
          <tr className="w-full">
            <td align="center">
              <Text className="m-0 text-[20px] font-bold leading-[28px] text-[#1a1a1a] tracking-[-0.02em]">
                Atlas
              </Text>
              <Text className="mb-[20px] mt-[4px] text-[14px] leading-[20px] text-[#a3a3a3]">
                Construyendo comunidad...
              </Text>
            </td>
          </tr>
          <tr>
            <td align="center">
              <Row className="table-cell h-[44px] w-[56px] align-bottom">
                <Column className="pr-[8px]">
                  <Link href="https://chat.whatsapp.com/KwzMiTVELkxER81NjXlkhN">
                    <WhatsApp className="mx-[4px]" width="24" height="24" />
                  </Link>
                </Column>
                <Column>
                  <Link href="https://www.instagram.com/proysocialud/?hl=es">
                    <Instagram className="mx-[4px]" width="24" height="24" />
                  </Link>
                </Column>
              </Row>
            </td>
          </tr>
        </table>
      </Section>
    </Tailwind>
  );
}