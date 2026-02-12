import { Button } from "@/components/ui/Button";
import "./TaskPagination.css";

interface TaskPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TaskPagination(props: TaskPaginationProps) {
  return (
    <div class="task-pagination">
      <Button
        variant="ghost"
        size="sm"
        disabled={props.page <= 1}
        onClick={() => props.onPageChange(props.page - 1)}
      >
        ← Prev
      </Button>
      <span class="task-pagination-info">
        {props.page} / {props.totalPages || 1}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={props.page >= props.totalPages}
        onClick={() => props.onPageChange(props.page + 1)}
      >
        Next →
      </Button>
    </div>
  );
}
