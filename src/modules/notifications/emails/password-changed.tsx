import { Section, Heading, Text } from "react-email";
import Layout from "./components/Layout";
import AlertBanner from "./components/AlertBanner";

export interface PasswordChangedProps {
  name: string;
}

export default function PasswordChanged(props: PasswordChangedProps) {
  const { name } = props;

  return (
    <Layout previewText="Tu contraseña ha sido cambiada - Atlas">
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Seguridad
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Tu contraseña ha sido actualizada
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[380px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Hola {name}, te confirmamos que tu contraseña cambió correctamente.
          Si no fuiste tú, contacta al equipo de soporte lo antes posible.
        </Text>

        <AlertBanner variant="success">
          Tu cuenta sigue protegida. Recuerda no compartir tu contraseña.
        </AlertBanner>
      </Section>
    </Layout>
  );
}
