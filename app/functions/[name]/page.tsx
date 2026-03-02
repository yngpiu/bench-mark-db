import { notFound } from "next/navigation";
import { getFunctionByName, getFunctions } from "@/lib/schema";
import { getDefaults } from "@/lib/default-params";
import { FunctionPageClient } from "./client";

export function generateStaticParams() {
  return getFunctions().map((f) => ({ name: f.name }));
}

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function FunctionPage({ params }: PageProps) {
  const { name } = await params;
  const fn = getFunctionByName(name);

  if (!fn) {
    notFound();
  }

  return (
    <FunctionPageClient
      name={fn.name}
      params={fn.params}
      returnType={fn.returnType}
      defaults={getDefaults(fn.name)}
    />
  );
}
