import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionConfirmationStudentProps {
  studentName: string;
  tutorName: string;
  subjectName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  modality: string;
  description?: string;
  sessionDetailsUrl: string;
  isVirtual: boolean;
  virtualLink?: string | null;
}

export default function SessionConfirmationStudent(
  props: SessionConfirmationStudentProps,
) {
  const {
    tutorName,
    subjectName,
    title,
    date,
    startTime,
    endTime,
    duration,
    modality,
    description,
    sessionDetailsUrl,
    isVirtual,
    virtualLink,
  } = props;

  return (
    <Layout previewText={`¡Sesión confirmada! ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Sesión confirmada
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          ¡Tu sesión de {subjectName} está confirmada!
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          {tutorName} aceptó tu solicitud. Guarda los detalles de la sesión.
        </Text>

        <SessionDetails
          title="Detalles de la sesión"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            { label: "Duración", value: `${duration}h` },
            { label: "Modalidad", value: modality },
            ...(description
              ? [{ label: "Descripción", value: description }]
              : []),
            ...(isVirtual
              ? [
                  {
                    label: "Enlace virtual",
                    value: virtualLink ?? "Se compartirá antes de la sesión",
                  },
                ]
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
