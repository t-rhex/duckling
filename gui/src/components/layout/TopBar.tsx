import { useLocation } from "@solidjs/router";
import { A } from "@solidjs/router";
import { Button } from "@/components/ui/Button";
import "./TopBar.css";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/tasks": "Tasks",
  "/tasks/new": "New Task",
  "/settings": "Settings",
};

export function TopBar() {
  const location = useLocation();

  const pageTitle = () => {
    if (location.pathname.match(/^\/tasks\/[^/]+$/) && location.pathname !== "/tasks/new") {
      return "Task Detail";
    }
    return ROUTE_TITLES[location.pathname] || "Duckling";
  };

  return (
    <div class="top-bar" data-tauri-drag-region>
      <div class="top-bar-left">
        <h1 class="top-bar-title">{pageTitle()}</h1>
      </div>
      <div class="top-bar-right">
        <A href="/tasks/new">
          <Button variant="primary" size="sm">New Task</Button>
        </A>
      </div>
    </div>
  );
}
