/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./App";
import Dashboard from "@/pages/Dashboard";
import TaskList from "@/pages/TaskList";
import TaskDetail from "@/pages/TaskDetail";
import NewTask from "@/pages/NewTask";
import Settings from "@/pages/Settings";

render(
  () => (
    <Router root={App}>
      <Route path="/" component={Dashboard} />
      <Route path="/tasks" component={TaskList} />
      <Route path="/tasks/new" component={NewTask} />
      <Route path="/tasks/:id" component={TaskDetail} />
      <Route path="/settings" component={Settings} />
    </Router>
  ),
  document.getElementById("root") as HTMLElement,
);
