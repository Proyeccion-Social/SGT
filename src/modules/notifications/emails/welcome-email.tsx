import { Section, Heading, Text, Button, Link } from "react-email";
import Layout from "./components/Layout";

export interface WelcomeEmailProps {
  fullName: string;
  loginUrl: string;
}

export default function WelcomeEmail(props: WelcomeEmailProps) {
  const { fullName, loginUrl } = props;

  return (
    <Layout previewText="Bienvenido a Atlas - Sistema de Gestión de Tutorías">
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          By: Proyección Social
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          ¡Bienvenido a Atlas, {fullName}!
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[380px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Tu cuenta ha sido confirmada exitosamente. Ya puedes acceder a la
          plataforma y comenzar a gestionar tus tutorías.
        </Text>

        <Section className="mb-[32px] text-left">
          <Text className="m-0 mb-[16px] text-center text-[14px] font-semibold tracking-[-0.02em] text-[#a3a3a3]">
            ¿Qué puedes hacer ahora?
          </Text>

          <table className="w-full" cellPadding="0" cellSpacing="0">
            <tbody>
              <tr>
                <td className="py-[10px] text-[15px] text-[#3c3c3c]">
                  — Buscar tutores por materia
                </td>
              </tr>
              <tr>
                <td className="py-[10px] border-t border-[#e7dcff] text-[15px] text-[#3c3c3c]">
                  — Agendar sesiones individuales
                </td>
              </tr>
              <tr>
                <td className="py-[10px] border-t border-[#e7dcff] text-[15px] text-[#3c3c3c]">
                  — Unirte a sesiones colaborativas
                </td>
              </tr>
              <tr>
                <td className="py-[10px] border-t border-[#e7dcff] text-[15px] text-[#3c3c3c]">
                  — Calificar tus tutorías
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Button
          href={loginUrl}
          className="inline-block rounded-[8px] bg-[#9f74ff] px-[28px] py-[14px] text-[15px] font-bold text-white no-underline"
        >
          Iniciar sesión
        </Button>

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
