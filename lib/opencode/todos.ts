import { isRecord } from './reply';
import type { Turn } from './timeline';

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type Todo = { content: string; status: TodoStatus };

const STATUSES: readonly unknown[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/** A completed or cancelled todo is finished: it no longer waits on the agent. */
export const todoFinished = (todo: Todo) => todo.status === 'completed' || todo.status === 'cancelled';

/**
 * The session's todo list. opencode's experimental `todowrite` tool keeps no state of its own and
 * every call replaces the whole list, so the list is the input of the latest completed call.
 */
export function sessionTodos(turns: readonly Turn[]): Todo[] {
  for (const turn of turns.toReversed()) {
    for (const step of turn.reply.steps.toReversed()) {
      for (const part of step.parts.toReversed()) {
        if (part.kind !== 'tool' || part.name !== 'todowrite' || part.status !== 'completed') continue;
        return Array.isArray(part.input.todos) ? part.input.todos.flatMap(parseTodo) : [];
      }
    }
  }
  return [];
}

function parseTodo(item: unknown): Todo[] {
  if (!isRecord(item) || typeof item.content !== 'string' || !item.content) return [];
  const status = STATUSES.includes(item.status) ? (item.status as TodoStatus) : 'pending';
  return [{ content: item.content, status }];
}

/** The todo the agent is on: the one in progress, else the next pending one, else the last finished one. */
export function currentTodo(todos: readonly Todo[]): Todo | undefined {
  return (
    todos.find((todo) => todo.status === 'in_progress') ??
    todos.find((todo) => todo.status === 'pending') ??
    todos.findLast((todo) => todo.status === 'completed') ??
    todos[0]
  );
}
