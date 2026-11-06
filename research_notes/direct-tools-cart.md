# Browser agent goal suite

Run: 2026-11-06; model: kilo/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free; 1 run(s) per task; agent side: browser guide and session skill routing.
Passed 1/1 runs (100.0%). False successes (done "success" on a failed task): 0. Loop-guard notes: 0. Extension notes: 0. Runs that ended in a server or provider error: 0.

Each run: a fresh session, the start page shared from the user's own tab, the goal as the only message, a scripted user who allows only the cards the task calls for. Graded on the answer, the browser calls, what reached the fixture server and the page state at the end.

| Task | Area | Passed | Done outcomes | Note (last failed run) |
| --- | --- | --- | --- | --- |
| add-to-cart | act and verify | 1/1 | success |  |
