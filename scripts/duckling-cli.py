#!/usr/bin/env python3
"""
duckling — CLI for submitting tasks to Duckling.

Usage:
    duckling "Fix the flaky test in auth service" --repo https://github.com/your-org/your-repo
    duckling status
    duckling status <task-id>
    duckling log <task-id>
    duckling pool
"""

from __future__ import annotations

import argparse
import sys
import time

import httpx

API_BASE = "http://localhost:8000"


def submit_task(args):
    """Submit a new task."""
    payload = {
        "description": args.description,
        "repo_url": args.repo,
        "branch": args.branch,
        "priority": args.priority,
        "source": "cli",
    }

    resp = httpx.post(f"{API_BASE}/api/tasks", json=payload)
    if resp.status_code == 201:
        task = resp.json()
        print("\033[32m✓ Task submitted!\033[0m")
        print(f"  ID:          {task['id'][:8]}")
        print(f"  Description: {task['description']}")
        print(f"  Status:      {task['status']}")
        print(f"  Repo:        {task['repo_url']}")
        print(f"\n  Track progress: duckling status {task['id'][:8]}")
        print(f"  View log:       duckling log {task['id'][:8]}")

        if args.follow:
            follow_task(task["id"])
    else:
        print(f"\033[31m✗ Error: {resp.json().get('detail', resp.text)}\033[0m")
        sys.exit(1)


def show_status(args):
    """Show task status."""
    if args.task_id:
        # Single task
        resp = httpx.get(f"{API_BASE}/api/tasks/{args.task_id}")
        if resp.status_code == 200:
            task = resp.json()
            status_color = {"completed": "32", "failed": "31", "running": "34"}.get(
                task["status"], "33"
            )
            print(f"\033[{status_color}m● {task['status']}\033[0m  {task['description'][:60]}")
            print(f"  ID:         {task['id'][:8]}")
            print(f"  Iterations: {task['iterations_used']}")
            if task.get("pr_url"):
                print(f"  PR:         {task['pr_url']}")
            if task.get("duration_seconds"):
                print(f"  Duration:   {task['duration_seconds']:.0f}s")
            if task.get("error_message"):
                print(f"  Error:      {task['error_message']}")
        else:
            print("\033[31m✗ Task not found\033[0m")
    else:
        # All tasks
        resp = httpx.get(f"{API_BASE}/api/tasks")
        if resp.status_code == 200:
            data = resp.json()
            tasks = data.get("tasks", [])
            if not tasks:
                print("No tasks yet.")
                return

            print(f"\n{'ID':<10} {'Status':<15} {'Description':<50} {'PR'}")
            print("─" * 90)
            for t in tasks:
                status_color = {"completed": "32", "failed": "31", "running": "34"}.get(
                    t["status"], "33"
                )
                pr = t.get("pr_url", "")[:30] if t.get("pr_url") else "—"
                print(
                    f"{t['id'][:8]:<10} \033[{status_color}m{t['status']:<15}\033[0m {t['description'][:48]:<50} {pr}"
                )
            print(f"\n{data.get('total', len(tasks))} total tasks")


def show_log(args):
    """Show agent execution log."""
    resp = httpx.get(f"{API_BASE}/api/tasks/{args.task_id}/log")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Task {data['task_id'][:8]} ({data['status']})\n")
        if data["log"]:
            for line in data["log"].split("\n"):
                if line.startswith("  ✓"):
                    print(f"\033[32m{line}\033[0m")
                elif line.startswith("  ✗"):
                    print(f"\033[31m{line}\033[0m")
                elif line.startswith("▶"):
                    print(f"\033[34m{line}\033[0m")
                else:
                    print(line)
        else:
            print("No log output yet.")
    else:
        print("\033[31m✗ Task not found\033[0m")


def show_pool(args):
    """Show warm pool stats."""
    resp = httpx.get(f"{API_BASE}/api/pool/stats")
    if resp.status_code == 200:
        stats = resp.json()
        print("\n\033[1mVM Warm Pool\033[0m")
        print(f"  Backend:        {stats['backend']}")
        print(f"  Target size:    {stats['target_pool_size']}")
        print(f"  Ready VMs:      \033[32m{stats['ready_vms']}\033[0m")
        print(f"  Claimed VMs:    \033[34m{stats['claimed_vms']}\033[0m")
        print(f"  Creating VMs:   \033[33m{stats['creating_vms']}\033[0m")
        print(f"  Error VMs:      \033[31m{stats['error_vms']}\033[0m")
        print(f"  Avg claim time: {stats['avg_claim_time_ms']:.1f}ms")

        # Visual pool
        pool_visual = ""
        for _ in range(stats["ready_vms"]):
            pool_visual += "\033[32m█\033[0m"
        for _ in range(stats["claimed_vms"]):
            pool_visual += "\033[34m█\033[0m"
        for _ in range(stats["creating_vms"]):
            pool_visual += "\033[33m░\033[0m"
        remaining = (
            stats["target_pool_size"]
            - stats["ready_vms"]
            - stats["claimed_vms"]
            - stats["creating_vms"]
        )
        pool_visual += "░" * max(0, remaining)
        print(f"\n  [{pool_visual}]")
    else:
        print("\033[31m✗ Failed to get pool stats\033[0m")


def follow_task(task_id: str):
    """Follow task progress in real-time."""
    print("\nFollowing task progress (Ctrl+C to stop)...")
    last_log_len = 0

    try:
        while True:
            resp = httpx.get(f"{API_BASE}/api/tasks/{task_id}/log")
            if resp.status_code == 200:
                data = resp.json()
                log = data.get("log", "")
                if len(log) > last_log_len:
                    new_lines = log[last_log_len:]
                    for line in new_lines.split("\n"):
                        if line.strip():
                            print(f"  {line}")
                    last_log_len = len(log)

                if data["status"] in ("completed", "failed", "cancelled"):
                    print(
                        f"\n\033[{'32' if data['status'] == 'completed' else '31'}m● Task {data['status']}\033[0m"
                    )
                    break

            time.sleep(2)
    except KeyboardInterrupt:
        print("\nStopped following.")


def main():
    parser = argparse.ArgumentParser(
        prog="duckling",
        description="Duckling CLI — submit coding tasks to autonomous agents",
    )
    parser.add_argument("--api", default=API_BASE, help="API base URL")
    subparsers = parser.add_subparsers(dest="command")

    # Submit
    submit_parser = subparsers.add_parser("submit", aliases=["run"], help="Submit a new task")
    submit_parser.add_argument("description", help="Task description")
    submit_parser.add_argument("--repo", required=True, help="Repository URL")
    submit_parser.add_argument("--branch", default="main", help="Base branch")
    submit_parser.add_argument(
        "--priority", default="medium", choices=["low", "medium", "high", "critical"]
    )
    submit_parser.add_argument("-f", "--follow", action="store_true", help="Follow task progress")

    # Status
    status_parser = subparsers.add_parser("status", aliases=["ls"], help="Show task status")
    status_parser.add_argument("task_id", nargs="?", help="Specific task ID")

    # Log
    log_parser = subparsers.add_parser("log", help="Show agent log")
    log_parser.add_argument("task_id", help="Task ID")

    # Pool
    subparsers.add_parser("pool", help="Show warm pool stats")

    args = parser.parse_args()

    if hasattr(args, "api"):
        global API_BASE
        API_BASE = args.api

    if args.command in ("submit", "run"):
        submit_task(args)
    elif args.command in ("status", "ls"):
        show_status(args)
    elif args.command == "log":
        show_log(args)
    elif args.command == "pool":
        show_pool(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
