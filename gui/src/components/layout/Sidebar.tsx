import { useLocation } from "@solidjs/router";
import { A } from "@solidjs/router";
import { ConnectionDot } from "@/components/ui/ConnectionDot";
import { isConnected } from "@/stores/connection";
import type { JSX } from "solid-js";
import "./Sidebar.css";

function DashboardIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function TasksIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="6" y1="3.5" x2="14" y2="3.5" />
      <line x1="6" y1="8" x2="14" y2="8" />
      <line x1="6" y1="12.5" x2="14" y2="12.5" />
      <circle cx="2.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlusCircleIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <line x1="8" y1="5.5" x2="8" y2="10.5" />
      <line x1="5.5" y1="8" x2="10.5" y2="8" />
    </svg>
  );
}

function GearIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.25M8 13.25V14.5M1.5 8h1.25M13.25 8H14.5M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
    </svg>
  );
}

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: DashboardIcon },
  { path: "/tasks", label: "Tasks", icon: TasksIcon },
  { path: "/tasks/new", label: "New Task", icon: PlusCircleIcon },
  { path: "/settings", label: "Settings", icon: GearIcon },
];

export function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav class="sidebar">
      <div class="sidebar-drag-region" data-tauri-drag-region />
      <div class="sidebar-logo">
        <span class="sidebar-logo-text">Duckling</span>
      </div>

      <div class="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <A
            href={item.path}
            class="sidebar-link"
            classList={{ active: isActive(item.path) }}
          >
            <span class="sidebar-link-icon">{item.icon()}</span>
            {item.label}
          </A>
        ))}
      </div>

      <div class="sidebar-footer">
        <ConnectionDot connected={isConnected()} />
        <span>{isConnected() ? "Connected" : "Disconnected"}</span>
      </div>
    </nav>
  );
}
