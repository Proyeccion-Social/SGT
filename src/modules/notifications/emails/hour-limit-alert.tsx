import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";
import AlertBanner from "./components/AlertBanner";

export interface HourLimitAlertProps {
  tutorName: string;
  weeklyHourLimit: number;
  hoursUsed: string;
  hoursRemaining: string;
  usagePercentage: string;
  alertLevel: "80_PERCENT" | "95_PERCENT" | "100_PERCENT";
  urgencyLevel: "warning" | "urgent" | "critical";
  is80Percent: boolean;
  is95Percent: boolean;
  is100Percent: boolean;
  canAcceptMore: boolean;
  sessionsUrl: string;
  settingsUrl: string;
}

const alertConfig = {
  "80_PERCENT": {
    title: "Has usado el 80% de tus horas semanales",
    banner: "Estás cerca de tu límite semanal. Planifica tus próximas sesiones.",
    variant: "warning" as const,
  },
  "95_PERCENT": {
    title: "Has usado el 95% de tus horas semanales",
    banner: "Quedan pocas horas disponibles. Revisa tus sesiones pendientes.",
    variant: "warning" as const,
  },
  "100_PERCENT": {
    title: "Has alcanzado tu límite semanal de horas",
    banner: "No podrás aceptar más sesiones hasta la próxima semana.",
    variant: "error" as const,
  },
};

export default function HourLimitAlert(props: HourLimitAlertProps) {
  const {
    tutorName,
    weeklyHourLimit,
    hoursUsed,
    hoursRemaining,
    usagePercentage,
    alertLevel,
    canAcceptMore,
    sessionsUrl,
    settingsUrl,
  } = props;

  const config = alertConfig[alertLevel];

  return (
    <Layout previewText={`Alerta de límite de horas - ${alertLevel}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Alerta de límite de horas
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          {config.title}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Hola {tutorName}, te informamos sobre el uso de tus horas semanales en
          Atlas.
        </Text>

        <AlertBanner variant={config.variant}>{config.banner}</AlertBanner>

        <SessionDetails
          title="Resumen de horas"
          items={[
            { label: "Límite semanal", value: `${weeklyHourLimit}h` },
            { label: "Horas usadas", value: `${hoursUsed}h` },
            { label: "Horas restantes", value: `${hoursRemaining}h` },
            { label: "Porcentaje usado", value: `${usagePercentage}%` },
          ]}
        />

        <EmailButton href={sessionsUrl}>Ver mis sesiones</EmailButton>

        {canAcceptMore && (
          <Text className="mt-[16px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
            Puedes ajustar tu disponibilidad en{" "}
            <Link
              href={settingsUrl}
              className="text-[#9f74ff] no-underline"
            >
              configuración
            </Link>
            .
          </Text>
        )}

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={sessionsUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {sessionsUrl}
        </Link>
      </Section>
    </Layout>
  );
}
