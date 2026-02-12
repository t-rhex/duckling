import { type JSX, splitProps } from "solid-js";
import "./Button.css";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "size", "class", "children"]);

  return (
    <button
      class={`btn btn-${local.variant || "ghost"} btn-${local.size || "md"} ${local.class || ""}`}
      {...rest}
    >
      {local.children}
    </button>
  );
}
