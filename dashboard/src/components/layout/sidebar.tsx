"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ListTodo,
  Server,
  Menu,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Missions", icon: ListTodo },
  { href: "/pool", label: "Fleet", icon: Server },
] as const

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 group">
      <span className="flex items-center font-mono text-lg font-bold tracking-tight">
        <span
          className="text-[var(--duckling-amber)]"
          style={{
            textShadow:
              "0 0 10px var(--duckling-amber-muted), 0 0 30px var(--duckling-amber-soft)",
          }}
        >
          d
        </span>
        {!collapsed && (
          <span className="text-foreground transition-colors">uckling</span>
        )}
      </span>
    </Link>
  )
}

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed = false,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  collapsed?: boolean
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-[var(--duckling-amber-soft)] text-[var(--duckling-amber)]"
          : "text-muted-foreground hover:bg-[var(--duckling-amber-soft)] hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {/* Active left bar indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--duckling-amber)]" />
      )}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors duration-200",
          isActive
            ? "text-[var(--duckling-amber)]"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed && <span>{label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="border-[var(--duckling-amber-muted)] bg-[var(--duckling-surface)] text-foreground"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function AmberDivider({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("relative py-3", collapsed ? "px-2" : "px-4")}>
      <div className="h-px w-full bg-border" />
      {/* Center amber dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="size-1 rounded-full bg-[var(--duckling-amber-muted)]" />
      </div>
    </div>
  )
}

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <div className={cn("flex h-full flex-col", collapsed ? "w-14" : "w-60")}>
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center",
          collapsed ? "justify-center px-2" : "px-4"
        )}
      >
        <Logo collapsed={collapsed} />
      </div>

      {/* Divider under logo */}
      <AmberDivider collapsed={collapsed} />

      {/* Nav items with staggered animation */}
      <nav className="stagger-children flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Divider with amber dot above footer */}
      <AmberDivider collapsed={collapsed} />

      {/* Footer: Mission Control + version */}
      <div className={cn("px-4 pb-4", collapsed && "px-2 text-center")}>
        <p
          className={cn(
            "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60",
            collapsed && "hidden"
          )}
        >
          Mission Control
        </p>
        <p
          className={cn(
            "font-mono text-[10px] text-muted-foreground/40 mt-0.5",
            collapsed && "text-[8px] mt-0"
          )}
        >
          v0.1.0
        </p>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      {/* Desktop sidebar — full width */}
      <aside className="sidebar-glow hidden lg:flex h-screen border-r border-border dark:bg-[#0C0A09] bg-card">
        <SidebarContent />
      </aside>

      {/* Tablet sidebar — collapsed to icons */}
      <aside className="sidebar-glow hidden md:flex lg:hidden h-screen border-r border-border dark:bg-[#0C0A09] bg-card">
        <SidebarContent collapsed />
      </aside>

      {/* Mobile — hamburger + sheet drawer */}
      <div className="flex md:hidden h-14 items-center dark:bg-[#0C0A09] bg-card px-4 relative">
        {/* Bottom amber gradient rule for mobile bar */}
        <div className="absolute bottom-0 left-0 right-0 h-px">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--duckling-amber-muted)] to-transparent" />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="size-5" />
              <span className="sr-only">Toggle navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-60 p-0 dark:bg-[#0C0A09] bg-card border-r-[var(--duckling-amber-muted)]"
            showCloseButton={false}
          >
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <Logo />
      </div>
    </>
  )
}
