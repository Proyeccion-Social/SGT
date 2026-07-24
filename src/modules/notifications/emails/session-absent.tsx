import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionAbsentProps {
  studentName: string;
  tutorName: string;
  subjectName: string;
  date: string;
  startTime: string;
  rescheduleUrl: string;
}

export default function SessionAbsent(props: SessionAbsentProps) {
  const { studentName, tutorName, subjectName, date, startTime, rescheduleUrl } =
    props;

  return (
    <Layout previewText={`Inasistencia registrada — ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Inasistencia registrada
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Se registró una inasistencia
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Hola {studentName}, no se registró tu asistencia a la sesión de{" "}
          {subjectName} del {date}.
        </Text>

        <SessionDetails
          title="Detalles de la sesión"
          items={[
            { label: "Tutor", value: tutorName },
            { label: "Materia", value: subjectName },
            { label: "Fecha", value: date },
            { label: "Hora", value: startTime },
          ]}
        />

        <EmailButton href={rescheduleUrl}>Reagendar sesión</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
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
