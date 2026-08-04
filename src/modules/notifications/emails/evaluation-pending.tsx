import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface EvaluationPendingProps {
  studentName: string;
  tutorName: string;
  subjectName: string;
  title: string;
  sessionDate: string;
  sessionTime: string;
  isReminder: boolean;
  evaluationUrl: string;
}

export default function EvaluationPending(props: EvaluationPendingProps) {
  const {
    studentName,
    tutorName,
    subjectName,
    title,
    sessionDate,
    sessionTime,
    isReminder,
    evaluationUrl,
  } = props;

  return (
    <Layout
      previewText={`${isReminder ? "Recordatorio: " : ""}Califica tu sesión de ${subjectName}`}
    >
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          {isReminder ? "Recordatorio de evaluación" : "Califica tu sesión"}
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          ¿Cómo fue tu sesión de {subjectName}?
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Hola {studentName}, tu opinión ayuda a mejorar Atlas y a otros
          estudiantes a encontrar la mejor tutoría.
        </Text>

        <SessionDetails
          title="Detalles de la sesión"
          items={[
            { label: "Tutor", value: tutorName },
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: sessionDate },
            { label: "Hora", value: sessionTime },
          ]}
        />

        <EmailButton href={evaluationUrl}>Calificar sesión</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={evaluationUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {evaluationUrl}
        </Link>
      </Section>
    </Layout>
  );
}
