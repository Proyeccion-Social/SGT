import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";
import AlertBanner from "./components/AlertBanner";

export interface SessionCancelledProps {
  recipientName: string;
  recipientRole: "tutor" | "estudiante";
  subjectName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  cancellationReason: string;
  cancelledBy: "tutor" | "estudiante";
  cancelledWithin24h: boolean;
  rescheduleUrl: string;
}

export default function SessionCancelled(props: SessionCancelledProps) {
  const {
    subjectName,
    title,
    date,
    startTime,
    endTime,
    cancellationReason,
    cancelledBy,
    cancelledWithin24h,
    rescheduleUrl,
  } = props;

  return (
    <Layout previewText={`Sesión cancelada — ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Sesión cancelada
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Tu sesión de {subjectName} fue cancelada
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          La sesión programada para el {date} a las {startTime} fue cancelada
          por {cancelledBy}.
        </Text>

        {cancelledWithin24h && (
          <AlertBanner variant="warning">
            Esta sesión fue cancelada con menos de 24 horas de anticipación.
          </AlertBanner>
        )}

        <SessionDetails
          title="Detalles de la sesión cancelada"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            { label: "Cancelado por", value: cancelledBy },
            { label: "Motivo", value: cancellationReason },
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
