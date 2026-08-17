import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Order Received",
};

export default function TransferInstructionsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-24 min-h-[calc(100vh-8rem)] flex flex-col items-center text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-black tracking-tighter uppercase">
          Order Received
        </h1>
        <p className="text-muted-foreground uppercase tracking-widest text-sm font-bold">
          Waiting for Payment
        </p>
      </div>

      <div className="w-full p-8 border border-black bg-slate-50 space-y-6 text-left">
        <p className="text-sm font-medium">
          Please transfer the exact total amount to the following bank account. Your
          order will not ship until the funds have cleared in our account.
        </p>

        <div className="space-y-2">
          <p className="font-bold text-xs uppercase tracking-widest text-slate-500">
            Bank Details
          </p>
          <p className="font-black">Company: [TODDS THREADS SRL]</p>
          <p className="font-black">IBAN: [RO44BTRLRONCRT0CU1820501]</p>
          <p className="font-black">Bank: [BANCA TRANSILVANIA]</p>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200">
          <p className="text-xs font-bold uppercase tracking-wider text-yellow-800">
            Important: Use your Name or Email as the payment reference so we can match
            it to your order.
          </p>
        </div>
      </div>

      <Link href="/">
        <Button className="h-14 rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-sm px-12">
          Return to Store
        </Button>
      </Link>
    </main>
  );
}
