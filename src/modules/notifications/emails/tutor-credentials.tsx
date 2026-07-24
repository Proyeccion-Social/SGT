import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface TutorCredentialsProps {
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}

export default function TutorCredentials(props: TutorCredentialsProps) {
  const { name, email, temporaryPassword, loginUrl } = props;

  return (
    <Layout previewText="Bienvenido a Atlas - Credenciales de Tutor">
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Credenciales de tutor
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Bienvenido al equipo de tutores, {name}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[380px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Tu cuenta ha sido creada. Accede con las siguientes credenciales y
          cámbiala en tu primer inicio de sesión.
        </Text>

        <SessionDetails
          title="Tus credenciales"
          items={[
            { label: "Correo electrónico", value: email },
            { label: "Contraseña temporal", value: temporaryPassword },
          ]}
        />

        <EmailButton href={loginUrl}>Iniciar sesión</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={loginUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {loginUrl}
        </Link>
      </Section>
    </Layout>
  );
}
