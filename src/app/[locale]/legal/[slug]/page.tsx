import { getLegalDocBySlug } from "@/lib/cms/markdown";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type LegalPageProps = Readonly<{
  params: Promise<Readonly<{
    slug: string;
    locale: string;
  }>>;
}>;

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const doc = await getLegalDocBySlug(`${slug}-${locale}`);

  return {
    title: doc?.title ?? "Legal",
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug, locale } = await params;
  // Fetch the markdown content based on the URL slug and locale
  // e.g., slug: "terms", locale: "en" -> fetches "terms-en.md"
  const doc = await getLegalDocBySlug(`${slug}-${locale}`);

  // If the file doesn't exist, trigger the native Next.js 404 page
  if (!doc) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-24 min-h-[calc(100vh-8rem)]">
      <div className="mb-12 border-b border-black pb-8">
        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase mb-4">
          {doc.title}
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Last Updated: {doc.updatedAt}
        </p>
      </div>

      {/* 
        The 'prose' class auto-styles the markdown HTML.
        We use overrides (e.g., prose-h2:uppercase) to match your Todd's Threads branding.
      */}
      <article
        className="prose prose-neutral max-w-none
          prose-headings:font-black prose-headings:tracking-tighter prose-headings:uppercase
          prose-h2:text-2xl prose-h2:border-b prose-h2:border-black prose-h2:pb-2 prose-h2:mt-12
          prose-p:text-slate-800 prose-p:leading-relaxed
          prose-a:font-bold prose-a:underline prose-a:decoration-2 prose-a:underline-offset-4 hover:prose-a:text-slate-600
          prose-li:marker:text-black"
        dangerouslySetInnerHTML={{ __html: doc.contentHtml }}
      />
    </main>
  );
}
