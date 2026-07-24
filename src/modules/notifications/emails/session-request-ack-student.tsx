import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionRequestAckStudentProps {
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
  status: string;
  sessionDetailsUrl: string;
}

export default function SessionRequestAckStudent(
  props: SessionRequestAckStudentProps,
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
    status,
    sessionDetailsUrl,
  } = props;

  return (
    <Layout previewText={`Solicitud enviada: ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Solicitud enviada
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Hemos enviado tu solicitud a {tutorName}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Te notificaremos cuando el tutor responda. Mientras tanto, revisa los
          detalles de tu solicitud.
        </Text>

        <SessionDetails
          title="Detalles de la solicitud"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            { label: "Duración", value: `${duration}h` },
            { label: "Modalidad", value: modality },
            { label: "Estado", value: status },
            ...(description
              ? [{ label: "Descripción", value: description }]
              : []),
          ]}
        />

        <EmailButton href={sessionDetailsUrl}>Ver detalles</EmailButton>

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
