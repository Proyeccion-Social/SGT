import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionRejectedProps {
  studentName: string;
  tutorName: string;
  subjectName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  rejectionReason: string;
  rescheduleUrl: string;
  tutorProfileUrl: string;
}

export default function SessionRejected(props: SessionRejectedProps) {
  const {
    tutorName,
    subjectName,
    title,
    date,
    startTime,
    endTime,
    rejectionReason,
    rescheduleUrl,
    tutorProfileUrl,
  } = props;

  return (
    <Layout previewText={`Solicitud no aceptada — ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Solicitud no aceptada
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          {tutorName} no puede aceptar tu solicitud
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Lamentamos las molestias. Puedes buscar otro tutor o proponer una
          nueva fecha.
        </Text>

        <SessionDetails
          title="Detalles de la solicitud"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            { label: "Motivo", value: rejectionReason },
          ]}
        />

        <EmailButton href={rescheduleUrl}>Reagendar sesión</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          También puedes revisar el{" "}
          <Link
            href={tutorProfileUrl}
            className="text-[#9f74ff] no-underline"
          >
            perfil del tutor
          </Link>{" "}
          o usar este enlace si el botón no funciona:
        </Text>
        <Link
          href={rescheduleUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {rescheduleUrl}
        </Link>
      </Section>
    </Layout>
  );
}
