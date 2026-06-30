"use client";

/* eslint-disable @next/next/no-img-element */

import NTPLogo from "ntp-logo-react";

export function FooterCompliance() {
  return (
    <section
      aria-label="Payment and consumer protection information"
      className="border-t border-slate-200 pt-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(180px,240px)_1fr] lg:items-center">
        <div className="flex justify-center rounded-none border border-white bg-white p-4 sm:justify-start">
          <div className="w-full max-w-48">
            <NTPLogo color="#ffffff" version="vertical" secret="145292" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
          <a
            href="https://anpc.ro/ce-este-sal/"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex w-full max-w-[250px] justify-center transition-opacity hover:opacity-80"
          >
            <img
              src="https://kitamaru.ro/images/anpc/anpc-sal.svg"
              alt="Solutionarea Alternativa a Litigiilor"
              className="h-auto w-full max-w-[250px] border-0"
            />
          </a>
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex w-full max-w-[250px] justify-center transition-opacity hover:opacity-80"
          >
            <img
              src="https://kitamaru.ro/images/anpc/anpc-sol.svg"
              alt="Solutionarea Online a Litigiilor"
              className="h-auto w-full max-w-[250px] border-0"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
