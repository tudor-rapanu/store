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

interface InvoiceEmailProps {
  customerName: string;
  orderId: string;
  invoiceUrl: string;
}

export default function InvoiceEmail({
  customerName,
  orderId,
  invoiceUrl,
}: InvoiceEmailProps) {
  return (
    <Html>
      <Preview>Your Todd&apos;s Threads invoice is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>TODD&apos;S THREADS</Heading>

          <Text style={text}>Hi {customerName},</Text>

          <Text style={text}>
            The invoice for your order <strong>#{orderId}</strong> is ready.
          </Text>

          <Button href={invoiceUrl} style={button}>
            Open invoice
          </Button>

          <Hr style={hr} />

          <Text style={smallText}>
            You can also access this invoice from your account or order summary.
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
