"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
}

interface SidebarSection {
  title: string;
  items: NavItem[];
}

interface AppSidebarProps {
  sections: SidebarSection[];
}

export function AppSidebar({ sections }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border/60 bg-muted/30 flex flex-col h-screen sticky top-0">
      <div className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <svg
              className="h-4 w-4 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
              <path d="M20 7c0 2.21-3.582 4-8 4S4 9.21 4 7s3.582-4 8-4 8 1.79 8 4z" />
              <path d="M4 12c0 2.21 3.582 4 8 4s8-1.79 8-4" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Bảng điều khiển CSDL</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        {sections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <Separator className="my-3 opacity-50" />}
            <div className="px-2 py-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h4>
            </div>
            <nav className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm transition-colors",
                    pathname === item.href
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </ScrollArea>
    </aside>
  );
}
