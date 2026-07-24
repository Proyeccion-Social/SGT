import { Section, Heading, Text, Link } from "react-email";
import Layout from "./components/Layout";
import EmailButton from "./components/EmailButton";
import SessionDetails from "./components/SessionDetails";

export interface SessionModificationRequestProps {
  recipientRole: string;
  requesterRole: string;
  subjectName: string;
  title: string;
  currentDate: string;
  currentTime: string;
  proposedChanges: string[];
  expiresAt: string;
  reviewUrl: string;
}

export default function SessionModificationRequest(
  props: SessionModificationRequestProps,
) {
  const {
    requesterRole,
    subjectName,
    title,
    currentDate,
    currentTime,
    proposedChanges,
    expiresAt,
    reviewUrl,
  } = props;

  return (
    <Layout previewText={`Propuesta de modificación — ${subjectName}`}>
      <Section className="bg-white px-[40px] py-[64px] text-center">
        <Text className="m-0 mb-[4px] text-[12px] font-medium tracking-[-0.02em] text-[#9f74ff]">
          Propuesta de modificación
        </Text>

        <Heading
          as="h1"
          className="m-0 mb-[16px] text-[32px] font-bold leading-[40px] text-[#1a1a1a]"
        >
          {requesterRole} propone cambios en tu sesión de {subjectName}
        </Heading>

        <Text className="m-0 mx-auto mb-[32px] max-w-[420px] text-[16px] leading-[24px] text-[#3c3c3c]">
          Revisa los cambios propuestos y responde antes de{" "}
          <span className="font-semibold text-[#1a1a1a]">{expiresAt}</span>.
        </Text>

        <SessionDetails
          title="Detalles actuales"
          items={[
            { label: "Materia", value: subjectName },
            { label: "Tema", value: title },
            { label: "Fecha", value: currentDate },
            { label: "Horario", value: currentTime },
          ]}
        />

        {proposedChanges.length > 0 && (
          <SessionDetails
            title="Cambios propuestos"
            items={proposedChanges.map((change) => ({
              label: "Propuesta",
              value: change,
            }))}
          />
        )}

        <EmailButton href={reviewUrl}>Revisar propuesta</EmailButton>

        <Text className="mt-[24px] mb-0 text-[13px] leading-[20px] text-[#a3a3a3]">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Link
          href={reviewUrl}
          className="break-all text-[12px] text-[#9f74ff] no-underline"
        >
          {reviewUrl}
        </Link>
      </Section>
    </Layout>
  );
}
