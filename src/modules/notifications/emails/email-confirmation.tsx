import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";

export interface EmailConfirmationProps {
  fullName: string;
  confirmationUrl: string;
}

export default function EmailConfirmation(props: EmailConfirmationProps) {
  const { fullName, confirmationUrl } = props;

  return (
    <Layout previewText="Confirma tu cuenta en Atlas">
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Confirma tu cuenta
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Activa tu cuenta en Atlas, {fullName}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[380px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Gracias por registrarte. Confirma tu correo para empezar a gestionar
          tus tutorías.
        </Text>

        <EmailButton href={confirmationUrl}>Confirmar cuenta</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={confirmationUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {confirmationUrl}
        </Link>
      </Section>
    </Layout>
  );
}
