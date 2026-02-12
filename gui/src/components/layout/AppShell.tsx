import { type ParentComponent } from "solid-js";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import "./AppShell.css";

export const AppShell: ParentComponent = (props) => {
  return (
    <div class="app-shell">
      <Sidebar />
      <div class="app-main">
        <TopBar />
        <div class="app-content">
          {props.children}
        </div>
      </div>
    </div>
  );
};
