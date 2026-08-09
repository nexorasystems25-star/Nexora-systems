import { notFound } from "next/navigation";
import { resolveTenantFromSlug } from "@nexora/auth";

interface CounselingPageProps {
  params: { slug: string };
}

export default async function CounselingPage({ params }: CounselingPageProps) {
  const tenant = await resolveTenantFromSlug(params.slug, "counseling");

  if (!tenant) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              {tenant.name}
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Welcome to {tenant.name}'s counseling practice
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
