"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ListTodo,
  PlusCircle,
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
import { Separator } from "@/components/ui/separator"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/tasks/new", label: "New Task", icon: PlusCircle },
  { href: "/pool", label: "Pool", icon: Server },
] as const

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-2">
      <span className="flex items-center font-mono text-lg font-bold tracking-tight">
        <span className="text-amber-500">d</span>
        {!collapsed && (
          <span className="text-foreground">uckling</span>
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
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-amber-500/10 text-amber-500"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive ? "text-amber-500" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed && <span>{label}</span>}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-amber-500" />
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  // Special case: /tasks/new should not highlight /tasks
  const isItemActive = (href: string) => {
    if (href === "/tasks" && pathname === "/tasks/new") return false
    return isActive(href)
  }

  return (
    <div className={cn("flex h-full flex-col", collapsed ? "w-14" : "w-60")}>
      <div className={cn("flex h-14 items-center", collapsed ? "justify-center px-2" : "px-4")}>
        <Logo collapsed={collapsed} />
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isItemActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <Separator />

      <div className={cn("p-3", collapsed ? "text-center" : "px-4")}>
        <p className={cn(
          "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
          collapsed && "hidden"
        )}>
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
      <aside className="hidden lg:flex h-screen border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Tablet sidebar — collapsed to icons */}
      <aside className="hidden md:flex lg:hidden h-screen border-r border-border bg-card">
        <SidebarContent collapsed />
      </aside>

      {/* Mobile — hamburger + sheet drawer */}
      <div className="flex md:hidden h-14 items-center border-b border-border bg-card px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="size-5" />
              <span className="sr-only">Toggle navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <Logo />
      </div>
    </>
  )
}
