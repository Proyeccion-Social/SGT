import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionDetailsChange {
  label: string;
  previous: string | null;
  current: string | null;
}

export interface SessionDetailsUpdatedProps {
  subjectName: string;
  date: string;
  startTime: string;
  endTime: string;
  newTitle: string;
  newDescription?: string | null;
  newLocation?: string | null;
  newVirtualLink?: string | null;
  sessionDetailsUrl: string;
  changes: SessionDetailsChange[];
  hasChanges: boolean;
}

export default function SessionDetailsUpdated(
  props: SessionDetailsUpdatedProps,
) {
  const {
    subjectName,
    date,
    startTime,
    endTime,
    newTitle,
    newDescription,
    newLocation,
    newVirtualLink,
    sessionDetailsUrl,
    changes,
    hasChanges,
  } = props;

  return (
    <Layout previewText={`Detalles actualizados — ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Detalles actualizados
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          Se actualizaron los detalles de tu sesión
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          La sesión de {subjectName} tiene nueva información. Revisa los cambios
          a continuación.
        </Text>

        <SessionDetails
          title="Nuevos detalles"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: newTitle },
            { label: "Fecha", value: date },
            { label: "Horario", value: `${startTime} - ${endTime}` },
            ...(newDescription
              ? [{ label: "Descripción", value: newDescription }]
              : []),
            ...(newLocation
              ? [{ label: "Ubicación", value: newLocation }]
              : []),
            ...(newVirtualLink
              ? [{ label: "Enlace virtual", value: newVirtualLink }]
              : []),
          ]}
        />

        {hasChanges && (
          <SessionDetails
            title="Cambios realizados"
            items={changes.map((change) => ({
              label: change.label,
              value: (
                <>
                  <span className="text-[#a3a3a3] line-through">
                    {change.previous ?? "—"}
                  </span>
                  <br />
                  <span className="font-semibold text-[#1a1a1a]">
                    {change.current ?? "—"}
                  </span>
                </>
              ),
            }))}
          />
        )}

        <EmailButton href={sessionDetailsUrl}>Ver sesión actualizada</EmailButton>

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
