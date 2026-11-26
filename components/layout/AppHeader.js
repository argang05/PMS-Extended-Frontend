"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { LayoutDashboard, ChartNoAxesCombined, ShieldCheck, UserRound, LogOut, ChevronDown, Menu, X, Check } from "lucide-react";

const navClass = "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200";
const activeClass = "bg-[#F6490D]/15 text-[#FF6937]";
const inactiveClass = "text-gray-300 hover:bg-white/[0.06] hover:text-white";
const ANALYTICS_EVENT = "tor:analytics-release-changed";
const ANALYTICS_INTERVAL = 30000;

function NavigationLink({ href, icon: Icon, label, active, onClick }) {
  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={`${navClass} ${active ? activeClass : inactiveClass}`}>
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

export default function AppHeader() {
  const { user, logout, accessToken } = useAuth();
  const pathname = usePathname();
  const dropdownRef = useRef(null);
  const mobileRef = useRef(null);
  const [showAnalyticsLink, setShowAnalyticsLink] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const employeeNumber = String(user?.employee_number || "");
  const isAdminScoringUser = employeeNumber === "100607";
  const fullName = user?.full_name?.trim() || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Employee";
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0].toUpperCase()).join("") || "U";

  useEffect(() => {
    setShowAnalyticsLink(false);
    if (!accessToken) return;
    let disposed = false;
    let activeRequest = null;

    async function checkAnalyticsRelease(force = false) {
      if (disposed || document.visibilityState === "hidden") return;
      if (activeRequest) {
        if (!force) return;
        activeRequest.abort();
      }
      const controller = new AbortController();
      activeRequest = controller;
      const isCurrent = () => !disposed && !controller.signal.aborted && activeRequest === controller;
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const options = { method: "GET", headers, cache: "no-store", signal: controller.signal };
        const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/evaluations/self-review-status/`, options);
        const statusData = await statusRes.json();
        if (!isCurrent()) return;
        if (!statusRes.ok || !statusData?.questionnaire_id) {
          setShowAnalyticsLink(false);
          return;
        }
        const releaseRes = await fetch(`/api/scoring/my-analytics/${statusData.questionnaire_id}`, options);
        if (isCurrent()) setShowAnalyticsLink(releaseRes.ok);
      } catch (error) {
        if (error.name !== "AbortError" && isCurrent()) {
          console.error("Failed to check analytics release:", error);
          setShowAnalyticsLink(false);
        }
      } finally {
        if (activeRequest === controller) activeRequest = null;
      }
    }

    function handleAnalyticsChange(event) {
      const affectedEmployee = String(event.detail?.employeeNumber || "");
      if (affectedEmployee && affectedEmployee !== employeeNumber) return;
      if (event.detail?.isReleased === false) setShowAnalyticsLink(false);
      checkAnalyticsRelease(true);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkAnalyticsRelease();
    }

    function handleFocus() {
      checkAnalyticsRelease();
    }

    checkAnalyticsRelease();
    const interval = window.setInterval(() => checkAnalyticsRelease(), ANALYTICS_INTERVAL);
    window.addEventListener(ANALYTICS_EVENT, handleAnalyticsChange);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      activeRequest?.abort();
      window.clearInterval(interval);
      window.removeEventListener(ANALYTICS_EVENT, handleAnalyticsChange);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accessToken, pathname, employeeNumber]);

  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setProfileOpen(false);
      if (mobileRef.current && !mobileRef.current.contains(event.target)) setMobileOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const navigation = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(showAnalyticsLink ? [{ href: "/analytics-result", label: "Analytics Result", icon: ChartNoAxesCombined }] : []),
    ...(isAdminScoringUser ? [{ href: "/admin-console/dashboard", label: "Admin Console", icon: ShieldCheck }] : [])
  ];

  function isActive(href) {
    if (href === "/admin-console/dashboard") return pathname?.startsWith("/admin-console");
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  function handleLogout() {
    setProfileOpen(false);
    setMobileOpen(false);
    logout();
  }

  return (
    <header className="relative z-50 w-full border-b border-white/[0.06] bg-[#121212] text-white">
      <div className="grid h-[72px] w-full grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-8 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/dashboard" className="group flex w-fit items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#F6490D] text-lg font-bold text-white transition-transform duration-200 group-hover:scale-105">T</div>
          <span className="text-xl font-bold tracking-[-0.05em] text-white">tor<span className="text-[#FF6937]">.ai</span></span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center justify-center gap-1.5 md:flex">
          {navigation.map(item => <NavigationLink key={item.href} {...item} active={isActive(item.href)} />)}
        </nav>
        <div className="flex items-center justify-end gap-4">
          <div ref={dropdownRef} className="relative">
            <button type="button" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(previous => !previous)} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/[0.05]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6490D] text-xs font-bold text-white">{initials}</div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-3 w-[280px] origin-top-right overflow-hidden rounded-2xl border border-gray-200 bg-white text-[#111827] shadow-[0_16px_45px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150">
                <div className="border-b border-gray-100 bg-gray-50/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6490D] text-sm font-bold text-white">{initials}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{fullName}</p>
                      {user?.employee_number && <p className="mt-0.5 text-xs text-gray-500">Employee ID: {user.employee_number}</p>}
                    </div>
                  </div>
                  {user?.department && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Department</p>
                      <p className="mt-0.5 text-xs font-medium text-gray-700">{user.department}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive("/profile") ? "bg-[#FFF1EC] text-[#F6490D]" : "text-gray-700 hover:bg-gray-100"}`}>
                    <UserRound className="h-4 w-4" strokeWidth={1.8} />
                    <span className="flex-1">Your Profile</span>
                    {isActive("/profile") && <Check className="h-4 w-4" />}
                  </Link>
                </div>
                <div className="border-t border-gray-100 p-2">
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50">
                    <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
          <div ref={mobileRef} className="md:hidden">
            <button type="button" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(previous => !previous)} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 transition-colors hover:bg-white/10 hover:text-white">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {mobileOpen && (
              <nav aria-label="Mobile navigation" className="absolute left-0 right-0 top-full space-y-1 border-t border-white/10 bg-[#121212] px-4 py-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                {navigation.map(item => <NavigationLink key={item.href} {...item} active={isActive(item.href)} onClick={() => setMobileOpen(false)} />)}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}