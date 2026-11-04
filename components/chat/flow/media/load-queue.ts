/**
 * One queue for every image the panel loads: at most a few downloads run at once, in the order
 * they came near the screen, so a reply with a hundred images never floods the connection the
 * reply itself is streaming over. A cancelled task that has not started never runs.
 */
const LIMIT = 4;

type Task = () => Promise<unknown>;

let running = 0;
const waiting: Task[] = [];

function next() {
  while (running < LIMIT && waiting.length > 0) {
    const task = waiting.shift()!;
    running += 1;
    void task().finally(() => {
      running -= 1;
      next();
    });
  }
}

/** Runs `task` when a slot is free. Returns a cancel that drops it if it has not started. */
export function enqueue(task: Task): () => void {
  waiting.push(task);
  next();
  return () => {
    const at = waiting.indexOf(task);
    if (at >= 0) waiting.splice(at, 1);
  };
}
