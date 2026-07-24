import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";
import AlertBanner from "./components/AlertBanner";

export interface AvailabilityChangedProps {
  studentName: string;
  tutorName: string;
  subjectName: string;
  title: string;
  originalDate: string;
  originalTime: string;
  changeType: "CANCELLED" | "MODIFIED" | "SLOT_DELETED";
  isCancelled: boolean;
  isModified: boolean;
  isSlotDeleted: boolean;
  changeReason: string;
  rescheduleUrl: string;
  tutorProfileUrl: string;
}

const changeTypeLabels = {
  CANCELLED: "cancelada",
  MODIFIED: "modificada",
  SLOT_DELETED: "eliminada por cambio de disponibilidad",
};

export default function AvailabilityChanged(props: AvailabilityChangedProps) {
  const {
    tutorName,
    subjectName,
    title,
    originalDate,
    originalTime,
    changeType,
    changeReason,
    rescheduleUrl,
    tutorProfileUrl,
  } = props;

  return (
    <Layout previewText={`Cambio en disponibilidad — ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Cambio en disponibilidad
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Tu sesión fue {changeTypeLabels[changeType]}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          El tutor {tutorName} tuvo un cambio en su disponibilidad que afecta tu
          sesión de {subjectName}.
        </Text>

        <AlertBanner variant="warning">
          Es necesario reagendar o buscar otro horario disponible.
        </AlertBanner>

        <SessionDetails
          title="Detalles de la sesión afectada"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha original", value: originalDate },
            { label: "Horario original", value: originalTime },
            { label: "Motivo", value: changeReason },
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
