import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface CollaborativeSessionAvailableProps {
  tutorName: string;
  subjectName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  modality: string;
  description?: string;
  joinUrl: string;
}

export default function CollaborativeSessionAvailable(
  props: CollaborativeSessionAvailableProps,
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
    joinUrl,
  } = props;

  return (
    <Layout
      previewText={`Nueva sesión colaborativa disponible: ${subjectName}`}
    >
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Nueva sesión colaborativa
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Nueva sesión colaborativa disponible
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          {tutorName} abrió una sesión colaborativa de {subjectName}. Únete y
          aprende en grupo.
        </Text>

        <SessionDetails
          title="Detalles de la sesión"
          items={[
            { label: "Tutor", value: tutorName },
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            { label: "Duración", value: `${duration}h` },
            { label: "Modalidad", value: modality },
            ...(description
              ? [{ label: "Descripción", value: description }]
              : []),
          ]}
        />

        <EmailButton href={joinUrl}>Unirme a la sesión</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={joinUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {joinUrl}
        </Link>
      </Section>
    </Layout>
  );
}
