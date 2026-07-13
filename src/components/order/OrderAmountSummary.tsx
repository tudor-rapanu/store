type OrderAmountSummaryProps = {
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  paymentAmount?: number | null;
  paymentCurrency: string;
};

function formatRon(amount: number) {
  return `${(amount / 100).toFixed(2)} RON`;
}

export function OrderAmountSummary({
  subtotalAmount,
  discountAmount,
  shippingAmount,
  totalAmount,
  paymentAmount,
  paymentCurrency,
}: OrderAmountSummaryProps) {
  return (
    <>
      <p>Subtotal: {formatRon(subtotalAmount)}</p>
      {discountAmount > 0 && <p>Discount: -{formatRon(discountAmount)}</p>}
      <p>Shipping: {formatRon(shippingAmount)}</p>
      <p>Total: {formatRon(totalAmount)}</p>
      <p>
        Payment: {((paymentAmount ?? totalAmount) / 100).toFixed(2)}{" "}
        {paymentCurrency}
      </p>
    </>
  );
}
