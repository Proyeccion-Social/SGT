import { Tailwind, pixelBasedPreset, Head, Preview, Body, Container, Font, Html } from "react-email";
import type { ReactNode } from "react";
import Footer from "./Footer";
import Nav from "./Nav";

interface LayoutProps {
  previewText: string;
  children: ReactNode;
}

export default function Layout({ previewText, children }: LayoutProps) {
    return (
        <Html lang="es">
            <Tailwind
                config={{
                    presets: [pixelBasedPreset],
                    theme: {
                        extend: {
                            fontFamily: {
                                sans: ["Inter", "Arial", "sans-serif"],
                            },
                            colors: {
                                primary: "#9f74ff",
                                secondary: "#c1ff72",
                                headings: "#1a1a1a",
                                body: "#3c3c3c",
                                bodyLight: "#a3a3a3",
                            },
                        },
                    },
                }}
            >
                <Head>
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <meta name="color-scheme" content="light" />
                    <meta name="supported-color-schemes" content="light" />
                    <Font
                        fontFamily="Inter"
                        fallbackFontFamily="Arial"
                        webFont={{
                            url: "https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTcviYwY.woff2",
                            format: "woff2",
                        }}
                        fontWeight={400}
                        fontStyle="normal"
                    />
                    <Font
                        fontFamily="Inter"
                        fallbackFontFamily="Arial"
                        webFont={{
                            url: "https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTcviYwY.woff2",
                            format: "woff2",
                        }}
                        fontWeight={500}
                        fontStyle="normal"
                    />
                    <Font
                        fontFamily="Inter"
                        fallbackFontFamily="Arial"
                        webFont={{
                            url: "https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTcviYwY.woff2",
                            format: "woff2",
                        }}
                        fontWeight={600}
                        fontStyle="normal"
                    />
                    <Font
                        fontFamily="Inter"
                        fallbackFontFamily="Arial"
                        webFont={{
                            url: "https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTcviYwY.woff2",
                            format: "woff2",
                        }}
                        fontWeight={700}
                        fontStyle="normal"
                    />
                </Head>

                <Preview>{previewText}</Preview>

                <Body className="bg-white py-0 font-sans sm:bg-[#f3edff] sm:py-[32px]">
                    <Container className="mx-auto w-full max-w-full rounded-none bg-white sm:max-w-[600px] sm:rounded-[16px]">
                        <Nav />
                        {children}
                        <Footer />
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}