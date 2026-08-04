import { Section, Row, Column, Img, Tailwind, Text } from "react-email";

export default function Nav() {
    return (
        <Tailwind>
            <Section className="px-[32px] py-[32px] max-sm:px-[24px] max-sm:py-[24px]">
                <Row>
                    <Column align="left" className="align-middle">
                        <Row align="left">
                            <Column className="w-[44px]">
                                <Img
                                    alt="Atlas Email logo"
                                    width="44"
                                    className="h-auto"
                                    src="https://atlas.proysocial.org/_astro/icon.Cm0aBCpz.svg"
                                />
                            </Column>
                            <Column className="pl-[4px]">
                                <Text className="m-0 text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-[#1a1a1a]">
                                    Atlas
                                </Text>
                            </Column>
                        </Row>
                    </Column>
                </Row>
            </Section>  
        </Tailwind>
    )
}
