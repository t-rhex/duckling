import type { RouteSectionProps } from "@solidjs/router";
import { AppShell } from "@/components/layout/AppShell";
import { useConnection } from "@/stores/connection";
import "@/index.css";

export default function App(props: RouteSectionProps) {
  useConnection();

  return (
    <AppShell>
      {props.children}
    </AppShell>
  );
}
