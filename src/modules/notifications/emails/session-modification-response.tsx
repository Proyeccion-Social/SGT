import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";
import AlertBanner from "./components/AlertBanner";

export interface SessionModificationResponseProps {
  accepted: boolean;
  subjectName: string;
  title: string;
  originalDate: string;
  originalTime: string;
  newDate?: string;
  newTime?: string;
  newModality?: string | null;
  sessionDetailsUrl: string;
}

export default function SessionModificationResponse(
  props: SessionModificationResponseProps,
) {
  const {
    accepted,
    subjectName,
    title,
    originalDate,
    originalTime,
    newDate,
    newTime,
    newModality,
    sessionDetailsUrl,
  } = props;

  return (
    <Layout
      previewText={`${accepted ? "Modificación aceptada" : "Modificación rechazada"} — ${subjectName}`}
    >
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          {accepted ? "Propuesta aceptada" : "Propuesta rechazada"}
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          {accepted
            ? "Los cambios en tu sesión fueron aceptados"
            : "Los cambios en tu sesión no fueron aceptados"}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          {accepted
            ? `La sesión de ${subjectName} se actualizará con los nuevos detalles.`
            : `La sesión de ${subjectName} conservará los detalles originales.`}
        </Text>

        <AlertBanner variant={accepted ? "success" : "error"}>
          {accepted
            ? "La propuesta fue aceptada exitosamente."
            : "La propuesta no fue aceptada."}
        </AlertBanner>

        <SessionDetails
          title="Detalles de la sesión"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha original", value: originalDate },
            { label: "Horario original", value: originalTime },
            ...(accepted && newDate
              ? [{ label: "Nueva fecha", value: newDate }]
              : []),
            ...(accepted && newTime
              ? [{ label: "Nuevo horario", value: newTime }]
              : []),
            ...(accepted && newModality
              ? [{ label: "Nueva modalidad", value: newModality }]
              : []),
          ]}
        />

        <EmailButton href={sessionDetailsUrl}>Ver sesión</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={sessionDetailsUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {sessionDetailsUrl}
        </Link>
      </Section>
    </Layout>
  );
}
