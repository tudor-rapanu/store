import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface CustomerNoteEmailProps {
  customerName: string;
  orderId: string;
  note: string;
  orderUrl?: string;
}

export default function CustomerNoteEmail({
  customerName,
  orderId,
  note,
  orderUrl,
}: CustomerNoteEmailProps) {
  return (
    <Html lang="ro">
      <Preview>{`Noutăți despre comanda ta Todd's Threads #${orderId}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>TODD&apos;S THREADS</Heading>

          <Text style={text}>Salut {customerName},</Text>

          <Text style={text}>
            Avem noutăți despre comanda ta <strong>#{orderId}</strong>:
          </Text>

          <Text style={noteBox}>{note}</Text>

          {orderUrl && (
            <Button href={orderUrl} style={button}>
              Vezi comanda
            </Button>
          )}

          <Hr style={hr} />

          <Text style={smallText}>
            Ai întrebări? Răspunde direct la acest email.
          </Text>
          <Text style={smallText}>Todd&apos;s Threads | Series 01</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Helvetica, Arial, sans-serif",
};
const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "600px",
};
const h1 = {
  fontSize: "24px",
  fontWeight: "900",
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
};
const text = {
  color: "#000000",
  fontSize: "14px",
  lineHeight: "24px",
};
const noteBox = {
  ...text,
  border: "1px solid #000000",
  padding: "16px",
  whiteSpace: "pre-wrap" as const,
};
const button = {
  backgroundColor: "#000000",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "1px",
  margin: "20px 0",
  padding: "14px 18px",
  textDecoration: "none",
  textTransform: "uppercase" as const,
};
const hr = {
  borderColor: "#000000",
  margin: "32px 0",
};
const smallText = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "20px",
};
