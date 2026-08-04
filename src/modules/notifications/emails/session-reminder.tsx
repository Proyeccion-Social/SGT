import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionReminderProps {
  recipientName: string;
  recipientRole: "tutor" | "estudiante";
  counterpartName: string;
  subjectName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  modality: string;
  location?: string | null;
  virtualLink?: string | null;
  timeUntilSession: string;
  is24Hours: boolean;
  is2Hours: boolean;
  sessionDetailsUrl: string;
  cancelUrl: string;
}

export default function SessionReminder(props: SessionReminderProps) {
  const {
    recipientName,
    counterpartName,
    subjectName,
    title,
    date,
    startTime,
    endTime,
    modality,
    location,
    virtualLink,
    timeUntilSession,
    is24Hours,
    sessionDetailsUrl,
    cancelUrl,
  } = props;

  return (
    <Layout
      previewText={`Recordatorio: sesión ${is24Hours ? "mañana" : "en 2 horas"} — ${subjectName}`}
    >
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Recordatorio
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          {is24Hours
            ? "Tu sesión es mañana"
            : "Tu sesión comienza en menos de 2 horas"}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Hola {recipientName}, te recordamos tu sesión de {subjectName} con{" "}
          {counterpartName}.
        </Text>

        <SessionDetails
          title="Detalles de la sesión"
          items={[
            { label: "Contraparte", value: counterpartName },
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            { label: "Modalidad", value: modality },
            ...(location ? [{ label: "Ubicación", value: location }] : []),
            ...(virtualLink
              ? [{ label: "Enlace virtual", value: virtualLink }]
              : []),
            { label: "Tiempo restante", value: timeUntilSession },
          ]}
        />

        <EmailButton href={sessionDetailsUrl}>
          Ver detalles de la sesión
        </EmailButton>

        {is24Hours && (
          <Text className="mt-[16px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
            ¿No podrás asistir?{" "}
            <Link href={cancelUrl} className="text-[#f02d3a] no-underline">
              Cancelar sesión
            </Link>
          </Text>
        )}

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
