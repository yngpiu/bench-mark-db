import { getTables } from "@/lib/schema";
import { ErDiagram } from "@/components/er-diagram";

export default function HomePage() {
  const tables = getTables();

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between shrink-0 bg-muted/20">
        <div>
          <h1 className="text-lg font-semibold">Sơ đồ quan hệ thực thể (ER Diagram)</h1>
          <p className="text-sm text-muted-foreground">
            {tables.length} bảng &middot; Phân tích từ bank.sql
          </p>
        </div>
      </header>
      <ErDiagram tables={tables} />
    </div>
  );
}
