import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";

export interface PasswordResetProps {
  name: string;
  resetUrl: string;
}

export default function PasswordReset(props: PasswordResetProps) {
  const { name, resetUrl } = props;

  return (
    <Layout previewText="Recupera tu contraseña - Atlas">
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Recuperar contraseña
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          ¿Olvidaste tu contraseña, {name}?
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[380px] text-[16px] leading-[24px] text-[#3c3c3c]">
          No te preocupes. Haz clic en el botón de abajo para crear una nueva
          contraseña. Este enlace expirará pronto por seguridad.
        </Text>

        <EmailButton href={resetUrl}>Restablecer contraseña</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={resetUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {resetUrl}
        </Link>
      </Section>
    </Layout>
  );
}
