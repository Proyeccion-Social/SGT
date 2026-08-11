import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";

export interface TutorProfileCompletedProps {
  name: string;
  dashboardUrl: string;
}

export default function TutorProfileCompleted(
  props: TutorProfileCompletedProps,
) {
  const { name, dashboardUrl } = props;

  return (
    <Layout previewText="Perfil de Tutor Completado - Atlas">
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Perfil completado
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Tu perfil de tutor está listo, {name}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[380px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Ya puedes empezar a recibir solicitudes de tutoría. Revisa tu panel
          para ver tu disponibilidad y sesiones.
        </Text>

        <EmailButton href={dashboardUrl}>Ir al panel</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={dashboardUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {dashboardUrl}
        </Link>
      </Section>
    </Layout>
  );
}
