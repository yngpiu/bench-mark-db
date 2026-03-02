import { notFound } from "next/navigation";
import { getProcedureByName, getProcedures } from "@/lib/schema";
import { getDefaults } from "@/lib/default-params";
import { ProcedurePageClient } from "./client";

export function generateStaticParams() {
  return getProcedures().map((p) => ({ name: p.name }));
}

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function ProcedurePage({ params }: PageProps) {
  const { name } = await params;
  const proc = getProcedureByName(name);

  if (!proc) {
    notFound();
  }

  return (
    <ProcedurePageClient
      name={proc.name}
      params={proc.params}
      defaults={getDefaults(proc.name)}
    />
  );
}
