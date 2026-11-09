import { memo, useState } from 'react';
import { cn } from 'cn';
import { Icon, type IconName } from '@/components/ui/icon';
import { currentTodo, todoFinished, type Todo, type TodoStatus } from '@/lib/opencode/todos';
import { MorphText } from '../flow/morph-text';
import { TrayRow } from './composer-tray';

/** Whether the todo row shows: a finished list folds away, so the tray only shows work still going on. */
export const showsTodos = (todos: readonly Todo[]) => todos.length > 0 && !todos.every(todoFinished);

/** One icon per state. A cancelled todo is the plain circle, told apart from a pending one by its struck label. */
const ICON: Record<TodoStatus, IconName> = { pending: 'circle', in_progress: 'progress', completed: 'circle-check', cancelled: 'circle' };
const ICON_NAMES = ['circle', 'progress', 'circle-check'] as const satisfies readonly IconName[];

/** primary: what the agent is on; secondary: what waits; tertiary (and struck through): what is over. */
const TEXT: Record<TodoStatus, string> = {
  pending: 'text-text-secondary',
  in_progress: 'text-text-primary',
  completed: 'text-text-tertiary',
  cancelled: 'text-text-tertiary',
};
const FADE = 'transition-colors duration-300 ease-(--ease-calm)';

/**
 * The state's icon. All three icons stay mounted in one box and fade into each other, so a todo
 * that moves on changes without the box (or anything beside it) moving.
 */
function StatusIcon({ status }: { status: TodoStatus }) {
  const active = ICON[status];
  return (
    <span data-slot="todo-icon" data-status={status} className={cn('relative size-4 shrink-0', TEXT[status], FADE)}>
      {ICON_NAMES.map((name) => (
        <Icon key={name} name={name} className={cn('absolute inset-0 transition-opacity duration-300 ease-(--ease-calm)', name === active ? 'opacity-100' : 'opacity-0')} />
      ))}
    </span>
  );
}

/** The todo's words; a finished todo gets a line drawn through it (global.css `[data-slot="todo-text"]`). */
function TodoText({ todo }: { todo: Todo }) {
  return (
    <span data-slot="todo-text" data-struck={todoFinished(todo) ? '' : undefined} className={TEXT[todo.status]}>
      {todo.content}
    </span>
  );
}

/**
 * The agent's todo list as a tray row. Folded, it is one line: the current todo's icon and its
 * words, which morph into the next todo's as the agent moves on. Opened, it lists every todo.
 */
export const TodoRow = memo(function TodoRow({ todos }: { todos: readonly Todo[] }) {
  // The last list stays on screen while the row folds away once every todo is finished.
  const [last, setLast] = useState(todos);
  if (todos.length > 0 && todos !== last) setLast(todos);
  const shown = todos.length > 0 ? todos : last;
  const current = currentTodo(shown);
  if (!current) return null;
  const done = shown.filter(todoFinished).length;
  return (
    <TrayRow
      shown={showsTodos(todos)}
      icon={<StatusIcon status={current.status} />}
      label="Todos"
      text={<MorphText id={current.content} text={current.content} className={cn('min-w-0', TEXT[current.status], FADE)} />}
      detailsLabel="Show todos"
      detailsClassName="pl-3"
      meta={<span aria-label={`${done} of ${shown.length} done`}>{done}/{shown.length}</span>}
      details={
        <ul className="flex flex-col gap-1.5">
          {shown.map((todo, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="flex h-[1.375rem] items-center"><StatusIcon status={todo.status} /></span>
              <TodoText todo={todo} />
            </li>
          ))}
        </ul>
      }
    />
  );
});
