"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, ListChecks, BrainCircuit,
  ChartNoAxesCombined, MessageSquareText, Settings2,
  CalendarDays, RotateCcw, BookOpen, ChevronDown
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

const navGroups = [
  {
    label: "Dashboard", icon: LayoutDashboard,
    href: "/admin-console/dashboard"
  },
  {
    label: "Performance", icon: ClipboardList,
    items: [
      { label: "Question Bank", href: "/admin-console/questions", icon: BookOpen },
      { label: "Questionnaire Builder", href: "/admin-console/questionnaires", icon: ListChecks }
    ]
  },
  {
    label: "Potential", icon: BrainCircuit,
    items: [
      { label: "Question Bank", href: "/admin-console/potential-question-bank", icon: BookOpen, aliases: ["/admin-console/questions/potential"] },
      { label: "Questionnaire Builder", href: "/admin-console/potential-questionnaire-builder", icon: ListChecks }
    ]
  },
  {
    label: "Scoring & Analytics", icon: ChartNoAxesCombined,
    items: [
      { label: "Scoring Console", href: "/admin-console/score-analytics", icon: ChartNoAxesCombined },
      { label: "Descriptive Scoring", href: "/admin-console/descriptive-scoring", icon: MessageSquareText },
      { label: "Score Configurations", href: "/admin-console/configurations", icon: Settings2 }
    ]
  },
  {
    label: "Settings", icon: Settings2,
    items: [
      { label: "Review Cycles", href: "/admin-console/cycles", icon: CalendarDays },
      { label: "PMS Reset", href: "/admin-console/reset-pms", icon: RotateCcw }
    ]
  }
];

function isRouteActive(pathname, item) {
  return pathname === item.href || (item.aliases || []).includes(pathname);
}

function navClass(active) {
  return `inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all duration-200 ${
    active
      ? "bg-[#FFF1EC] text-[#F6490D] shadow-sm"
      : "bg-[#FCFCFD] text-[#111827] hover:-translate-y-0.5 hover:bg-gray-100"
  }`;
}

export default function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin Console Navigation" className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Admin Console</p>
        <p className="mt-1 text-sm text-gray-600">HR operations, Performance and Potential management, scoring, configurations and review controls.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {navGroups.map(group => {
          const Icon = group.icon;
          const active = group.href
            ? isRouteActive(pathname, group)
            : group.items.some(item => isRouteActive(pathname, item));
          if (group.href) {
            return (
              <Link key={group.label} href={group.href} className={navClass(active)} aria-current={active ? "page" : undefined}>
                <Icon className="h-4 w-4" />{group.label}
              </Link>
            );
          }
          return (
            <DropdownMenu key={group.label}>
              <DropdownMenuTrigger asChild>
                <button type="button" className={`${navClass(active)} data-[state=open]:bg-[#FFF1EC] data-[state=open]:text-[#F6490D]`}>
                  <Icon className="h-4 w-4" />{group.label}<ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="min-w-64 rounded-2xl border-gray-100 bg-white p-2 shadow-xl">
                <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{group.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.items.map(item => {
                  const ItemIcon = item.icon;
                  const itemActive = isRouteActive(pathname, item);
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} aria-current={itemActive ? "page" : undefined} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${itemActive ? "bg-[#FFF1EC] font-medium text-[#F6490D]" : "text-gray-700 hover:bg-gray-50"}`}>
                        <ItemIcon className="h-4 w-4" />{item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </nav>
  );
}