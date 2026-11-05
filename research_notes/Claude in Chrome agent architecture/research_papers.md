# Academic and industry research on LLM web/browser agents, computer-use agents, and browser-agent safety

Verification note: The items marked [verified] were fetched from the primary source during this session (Nov 2026). Unmarked items with arXiv links are well-known paper results, cited from the papers' abstracts and headline tables as I know them. They were not re-fetched this session (the tool budget was spent on the most recent and most contested numbers), so the report writer should treat them as high-confidence but unre-verified. Unless noted, all numbers are task success rates.

## Q1. Benchmarks and agents: what they found about observations, grounding, and success rates, plus the latest SOTA

### Takeaway
Across benchmarks, the most consistent finding is that grounding (mapping an intended action onto the right element or coordinate) and long-horizon robustness are the bottlenecks, more than high-level planning. Agents that combine a pruned, structured text observation (DOM or accessibility tree with element IDs) with a screenshot outperform either one alone. Reported success on static or self-judged benchmarks (WebVoyager) overstates real-world ability by a large margin: Online-Mind2Web showed many agents losing 20 to 30+ points.

### Cited Findings

**Mind2Web (Deng et al., NeurIPS 2023 Datasets & Benchmarks)**
- 2,350 tasks from 137 real websites across 31 domains, recorded as offline snapshots. — [arXiv 2306.06070](https://arxiv.org/abs/2306.06070)
- Raw HTML is too large for LLM context. The authors' MindAct uses a two-stage approach: a small fine-tuned LM ranks and filters candidate elements, then an LLM picks among the top-k as multiple choice. This "candidate pruning + multiple-choice grounding" pattern became standard. Full-task success was in the single digits even when step-level accuracy was moderate, showing that per-step errors compound. — [arXiv 2306.06070](https://arxiv.org/abs/2306.06070)

**WebArena (Zhou et al., ICLR 2024)**
- 812 long-horizon tasks on self-hosted, realistic sites (e-commerce, forum, GitLab, CMS, map). The best GPT-4 agent reached 14.41% against 78.24% for humans. Observations were accessibility tree, HTML, or screenshot, with the accessibility tree plus element IDs as the default text observation. A common failure was the agent declaring tasks infeasible too early. — [arXiv 2307.13854](https://arxiv.org/abs/2307.13854)

**VisualWebArena (Koh et al., ACL 2024)**
- 910 visually grounded tasks (Classifieds, Shopping, Reddit). The best agent, GPT-4V with Set-of-Mark screenshots plus an accessibility tree, scored about 16.4% against about 88.7% for humans. Text-only LLM agents did markedly worse, and SoM-annotated screenshots helped on visually grounded tasks. — [arXiv 2401.13649](https://arxiv.org/abs/2401.13649)

**Set-of-Mark prompting (Yang et al., Microsoft, 2023)**
- Overlays numbered marks on segmented image regions so a VLM can reference regions by ID instead of producing coordinates. This substantially improved GPT-4V's visual grounding and is the origin of the "numbered boxes on interactive elements" technique used in web agents. — [arXiv 2310.11441](https://arxiv.org/abs/2310.11441)

**SeeAct, "GPT-4V(ision) is a Generalist Web Agent, if Grounded" (Zheng et al., ICML 2024)**
- With oracle (human) grounding, GPT-4V completed about 51% of tasks on live websites. The best automatic grounding strategy still left a large gap (roughly 20 to 30 points) against oracle grounding. Grounding was identified as the main bottleneck. — [arXiv 2401.01614](https://arxiv.org/abs/2401.01614)
- Among grounding strategies, using HTML element text and attributes as textual choices worked best. Set-of-Mark image annotation was surprisingly ineffective on dense web pages, where marks overlap and occlude content. — [arXiv 2401.01614](https://arxiv.org/abs/2401.01614)

**WebVoyager (He et al., ACL 2024)**
- 643 tasks on 15 popular live websites. A GPT-4V multimodal agent using screenshots with SoM-style element labels scored 59.1%, well above text-only baselines. The authors used a GPT-4V auto-evaluator that agreed with humans about 85% of the time. — [arXiv 2401.13919](https://arxiv.org/abs/2401.13919)
- Caveat: Online-Mind2Web later showed WebVoyager inflates results, because it has many easy and shortcut-able tasks, its evaluator gives false positives on hallucinated answers, and some tasks have gone stale. [verified] — [arXiv 2504.01382 HTML](https://arxiv.org/html/2504.01382)

**WebLINX (Lù, Kasner, Reddy, ICML 2024)**
- Conversational web navigation: 100K+ interactions across 2,300+ expert demonstrations on 155+ real websites. The authors introduced a "Dense Markup Ranker" to prune HTML to relevant elements. Smaller fine-tuned models beat zero-shot GPT-4V, but all models struggled to generalize to unseen websites. — [arXiv 2402.05930](https://arxiv.org/abs/2402.05930)

**OSWorld (Xie et al., NeurIPS 2024)**
- 369 real computer tasks in real OS VMs (Ubuntu and Windows, with web and desktop apps). Humans scored 72.36% and the best model only 12.24%, failing mainly on GUI grounding and operational knowledge. [verified] — [OSWorld site](http://osworld-v1.xlang.ai/)
- Input modes compared: screenshot, accessibility tree, screenshot + accessibility tree, and Set-of-Mark. Higher screenshot resolution generally improved performance. A longer text-based trajectory history helped, but screenshot-only history did not, and long history costs efficiency. VLM agents were not robust to UI layout changes or noise. [verified] — [OSWorld site](http://osworld-v1.xlang.ai/)

**Agent-E (Abuelsaad et al., Emergence AI, 2024)**
- Hierarchical design: a planner agent plus a browser-navigation agent. It used "DOM distillation" (task-dependent pruning of the DOM into a compact representation) and "change observation" (reporting what changed after each action as feedback). It reported 73.2% on WebVoyager, about 20 points above prior text-only agents and about 16 above multimodal ones. — [arXiv 2407.13032](https://arxiv.org/abs/2407.13032)
- On the harder Online-Mind2Web it scored only 28.0%. [verified] — [arXiv 2504.01382 HTML](https://arxiv.org/html/2504.01382)

**AgentOccam (Yang et al., ICLR 2025)**
- No new agent architecture, only refinement of the observation and action spaces so they match what LLMs saw in pretraining. The authors pruned the accessibility tree, removed rarely useful actions, added a `note` action and a "branch/prune" planning action, and kept history selective. This reached 43.1% on WebArena, about 9.8 points above the previous SOTA and +29.4% over the vanilla agent. — [arXiv 2410.13825](https://arxiv.org/abs/2410.13825)

**WebRL (Qi et al., ICLR 2025)**
- A self-evolving online-curriculum RL framework with an outcome-supervised reward model. On WebArena-Lite, Llama-3.1-8B went from 4.8% to 42.4% and GLM-4-9B from 6.1% to 43%, surpassing GPT-4-Turbo (about 17.6%). Open models trained with online RL can beat prompted frontier models. — [arXiv 2411.02337](https://arxiv.org/abs/2411.02337)

**BrowserGym / WorkArena (Drouin et al., ServiceNow, ICML 2024; BrowserGym ecosystem paper, Dec 2024)**
- WorkArena: 33 enterprise tasks on ServiceNow. WorkArena++ added compositional, long-horizon variants. BrowserGym is a unified gym environment that offers DOM, accessibility tree, screenshot, and SoM observations, a configurable action space (element-ID high-level actions vs coordinate actions), and a common harness across MiniWoB, WebArena, VisualWebArena, WorkArena, and more. The ecosystem paper benchmarked frontier models (Claude 3.5 Sonnet led at the time) and stressed reproducibility problems across benchmarks. — [arXiv 2403.07718](https://arxiv.org/abs/2403.07718); [arXiv 2412.05467](https://arxiv.org/abs/2412.05467)

**Online-Mind2Web, "An Illusion of Progress? Assessing the Current State of Web Agents" (Xue et al., OSU/Berkeley, COLM 2025)** [verified]
- 300 live tasks across 136 websites. The paper argues earlier results were over-optimistic. — [arXiv 2504.01382](https://arxiv.org/abs/2504.01382)
- Human-evaluated success: Operator 61.3%, Claude Computer Use 3.7 56.3%, SeeAct 30.7%, Browser Use 30.0%, Claude Computer Use 3.5 29.0%, Agent-E 28.0%. — [arXiv 2504.01382 HTML](https://arxiv.org/html/2504.01382)
- A simple search agent scored 51% on WebVoyager but 22% on Online-Mind2Web. Success falls about 31.6 points from easy to medium and another 15.4 from medium to hard. — [arXiv 2504.01382 HTML](https://arxiv.org/html/2504.01382)
- Failure modes: about 57.7% of Operator's errors were filter or sort mistakes (numeric and temporal constraints) and about 19.6% were navigation errors. Operator explores about 2.6x the human step count. Other agents are greedy (about 1.0x human steps) and get stuck at dead ends, ignore requirements, hallucinate that constraints are met, repeat actions, and over-rely on keyword search. Failed trajectories are roughly 2x longer than successful ones, often due to repeated actions or pop-ups. — [arXiv 2504.01382 HTML](https://arxiv.org/html/2504.01382)
- LLM-as-judge ("WebJudge") agreement with humans: o4-mini 85.7%, a fine-tuned WebJudge-7B 87.0%, GPT-4o 83.6%. The WebVoyager evaluator does worse because of false positives on hallucinated final answers. — [arXiv 2504.01382 HTML](https://arxiv.org/html/2504.01382)

**BrowseComp (Wei et al., OpenAI, April 2025)**
- 1,266 hard-to-find, easy-to-verify questions that need persistent, creative browsing. GPT-4o scored about 0.6% (1.9% with browsing), o1 about 9.9%, and Deep Research about 51.5%. Persistence and search-strategy reasoning matter more than raw browsing ability. — [arXiv 2504.12516](https://arxiv.org/abs/2504.12516)

**Frontier lab computer-use results (vendor-reported)**
- Claude 3.5 Sonnet computer use (Oct 2024): OSWorld 14.9% screenshot-only, against 7.8% for the next best. It reached 22.0% with more steps. — [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use)
- OpenAI CUA / Operator (Jan 2025): OSWorld 38.1%, WebArena 58.1%, WebVoyager 87%. It uses screenshot-only perception, trained with RL, and pauses for user confirmation and "takeover" on sensitive steps. — [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/)
- Claude Sonnet 4.5 (Sep 2025) reported OSWorld 61.4%, and Claude Opus 4.5 (Nov 2025) about 66%. — [Anthropic, Claude Sonnet 4.5](https://www.anthropic.com/news/claude-sonnet-4-5); [Anthropic, Claude Opus 4.5](https://www.anthropic.com/news/claude-opus-4-5)
- Gemini 2.5 Computer Use (Oct 2025) is a browser-optimized model. Google reported leading results on Online-Mind2Web and WebVoyager (about 69% on Online-Mind2Web as measured by Browserbase, from memory; exact numbers unverified). — [Google DeepMind blog](https://blog.google/technology/google-deepmind/gemini-computer-use-model/)
- 2026 OSWorld-Verified leaderboards (aggregators only; the official leaderboard page didn't render in fetch). BenchLM (Oct 29, 2026) lists Qwen3.8 Max at 86.1% and Claude Fable 5 / Mythos 5 at about 85%. Developers Digest (Oct 2026) lists claude-fable-5 at 86.0%. Yutori (Aug 2026) lists an "Intelligence-Indeed Agent" at 90.2%. Humans score 72.36%, so top agents now nominally exceed the human baseline. These sources conflict and are not primary. — [BenchLM](https://benchlm.ai/benchmarks/os-world-verified); [Developers Digest](https://www.developersdigest.tech/benchmarks/osworld); [Yutori](https://yutori.com/leaderboards/osworld-verified.md)
- Secondary reports describe an "OSWorld 2.0", with Opus 5 at 74.0% and Fable 5.1 at 80.7% (third-party aggregator, unverified). — [notes.dsebastien.net](https://notes.dsebastien.net/30+Areas/33+Permanent+notes/33.02+Content/Claude+Opus+5)

### Inferences
- Element-ID grounding over a pruned DOM or accessibility tree (Mind2Web, WebArena, Agent-E, AgentOccam, WebLINX) is the most reliable action interface for DOM-accessible web pages. Coordinate actions from screenshots (Claude computer use, CUA) generalize to canvases, iframes, and non-semantic UIs but depend on strong vision grounding. A browser extension has DOM access, so the strongest design is hybrid: an accessibility-tree or DOM snapshot with stable refs, plus a screenshot (optionally SoM-labelled) for visual verification, with coordinates as a fallback.
- Observation minimization helps: AgentOccam's gains came purely from pruning observations and actions, and Agent-E's from DOM distillation plus change observation.
- Filter, sort, and date-picker widgets are the dominant real-world failure class (Online-Mind2Web), so they deserve dedicated tools or verification.
- Judge success with an independent verifier, not the agent's own claim. Hallucinated success is a known failure mode.

### Gaps
- No primary source fetched for current (Nov 2026) official OSWorld-Verified, WebArena, or WebVoyager numbers for Claude Opus 5/5.5, OpenAI's latest CUA, or Gemini 3-era computer-use models. The aggregator numbers above conflict.
- Exact per-agent WebVoyager vs Online-Mind2Web drop figures appear only in a figure in the Online-Mind2Web paper.
- Exact Gemini 2.5 Computer Use benchmark numbers were not re-verified.

## Q2. Anthropic's own publications on computer use, agent and tool design, context engineering, and prompt-injection defense

### Takeaway
Anthropic's guidance favors simple, composable agent loops. It recommends well-designed, token-efficient tools with clear descriptions, careful curation of context (pruning old screenshots and tool results), and verify-after-act prompting. For browser safety it relies on layered defense: RL-trained robustness, classifiers on untrusted content, site permissions, and confirmation for high-risk actions. Even so, it reports non-zero residual attack success (about 1% for Opus 4.5 under adaptive attack).

### Cited Findings

**Computer use launch and tool design**
- Claude 3.5 Sonnet computer use (Oct 2024) was screenshot-based with pixel-coordinate actions. Anthropic described training Claude to count pixels to output accurate coordinates. — [Anthropic, Developing a computer use model](https://www.anthropic.com/news/developing-computer-use)
- Current docs [verified] recommend these resolutions: 1024x768 or 1280x720 for desktop, 1280x800 or 1366x768 for web apps, and nothing above 1920x1080. The API does not downscale. Opus 4.7+ accepts up to 2,576 px on the long edge and about 3.75 MP (4,784 visual tokens). Earlier models accept 1,568 px and about 1.15 MP. Claude returns coordinates in the screenshot's pixel space, so the client must scale them back up to the real screen, and on Retina (DPR 2) it must downscale or halve coordinates. — [Claude docs, Computer use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)
- Diagnosing misses [verified]: clicks consistently offset in one direction mean a scaling bug, while near-misses on small targets call for the `zoom` action (full-resolution region capture). The newest `computer_toolset_20260801` has 17 member tools, including screenshot, zoom, click variants, drag, scroll, type, key, hold_key, and wait. — [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)
- Prompting tips [verified]: "After each step, take a screenshot and carefully evaluate if you have achieved the right outcome", since Claude sometimes assumes actions succeeded. Prefer keyboard shortcuts for dropdowns and scrollbars. Place instruction text before the screenshot, and end batches of actions with a screenshot. — [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)
- Context cost [verified]: about 1,000 to 1,800 tokens per screenshot, with visual tokens = ceil(w/28) x ceil(h/28). There's a stricter limit above 20 images. Prune in batches, not every turn, to preserve the prompt cache, for example keep the last 3 screenshots and prune every 25 turns. On Claude 5.1+, prefer resizing plus server-side tool-result clearing over client-side pruning. — [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)
- Security recommendations [verified]: isolated VM or container, minimal data access, domain allowlists, a human in the loop for consequential actions (purchases, accepting terms or cookies, any affirmative consent), and an assumption that prompt injection is possible. Anthropic's classifiers scan tool results and steer Claude to confirm with the user. — [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)

**Agent and tool design essays**
- "Building effective agents" (Dec 2024) distinguishes workflows from agents and recommends the simplest workable pattern: prompt chaining, routing, parallelization, orchestrator-workers, and evaluator-optimizer, used before full autonomy. It stresses investing in the agent-computer interface (ACI), meaning tool docs and formats, as much as in prompts. — [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- "Writing effective tools for agents" (Sep 2025) advises consolidating many narrow tools into fewer, higher-level ones, namespacing them, returning meaningful, high-signal context (for example names over opaque IDs), adding pagination, truncation, and filtering for token efficiency, writing actionable error messages, and evaluating tools with real tasks. — [Anthropic, Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- "Effective context engineering for AI agents" (Sep 2025) treats context as a finite "attention budget" subject to "context rot". It recommends the smallest set of high-signal tokens, just-in-time retrieval via tools, compaction, structured note-taking, and sub-agents for long-horizon tasks. — [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**Prompt-injection defense for browser use**
- Claude for Chrome launch (Aug 25, 2025) [verified]: in 123 test cases across 29 attack scenarios, prompt-injection attack success was 23.6% without mitigations and 11.2% with the new mitigations in autonomous mode. On a browser-specific challenge set (hidden DOM form fields, injections in URL text and tab titles), it fell from 35.7% to 0%. The mitigations were site-level permissions, confirmations before high-risk actions (publishing, purchasing, sharing personal data), blocked high-risk site categories (financial, adult, pirated), improved system prompts, and classifiers in development. One example: before defenses, a phishing email led Claude to delete the user's emails without confirmation. — [Claude blog, Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)
- "Mitigating the risk of prompt injections in browser use" (Nov 24, 2025) [verified] measured browser-use attack success under an internal adaptive Best-of-N attacker (100 attempts per environment, about 2,200 to 3,200 attempts per bar). Results by model (model only / old safeguards / improved safeguards): Opus 4.5 8.0% / 7.6% / 1.4%; Sonnet 4.5 13.8% / 10.8% / 1.9%; Sonnet 4 13.8% / 10.7% / 2.0%; Haiku 4.5 12.0% / 11.1% / 2.4%. Defenses: RL training on injections in simulated web content, classifiers scanning all untrusted content entering context, and continuous human and automated red-teaming. Anthropic's caveat: "A 1% attack success rate... still represents meaningful risk." — [Anthropic, Prompt injection defenses](https://www.anthropic.com/research/prompt-injection-defenses)
- Later models (secondary reporting only): the Opus 4.8 system card reportedly gives a 31.5% raw browser hijack rate before safeguards and 0.5% with them. Opus 5 (July 2026) is reported as very hard to inject, with one report citing 0% across 129 browser scenarios with "Auto Mode" safeguards. — [pulse.bot](https://www.pulse.bot/ai/news/anthropics-browser-agent-got-hijacked-315-of-the-time-before-safeguards-engaged-08ce0929-21bd-42f1-ab59-1f78400b4f7f/); [The Decoder](https://the-decoder.com/opus-5-may-have-solved-browser-based-prompt-injection-the-biggest-security-flaw-haunting-ai-agents/); [Zvi on Opus 5 system card](https://thezvi.substack.com/i/208361260/alignment-6)

### Inferences
- For a Chrome-extension agent, Anthropic's own product uses permission-scoped sites, confirmation gates for irreversible or high-risk actions, and classifier screening of tool results. These are the baseline expected of a responsible browser agent.
- The 31.5% raw vs 0.5% safeguarded figures for Opus 4.8 (if accurate) suggest that a large share of robustness comes from the system layer (classifiers and safeguards), not the model alone. A third-party extension calling the raw API may not get all of those safeguards.

### Gaps
- Did not fetch the Opus 4.8, Opus 5, or Opus 5.5 system cards directly, so post-Opus-4.5 browser attack rates are secondary-sourced only.
- No primary source on how Claude in Chrome represents the page internally (accessibility tree vs screenshot). That would need product docs or reverse engineering, outside this paper review.

## Q3. Safety research: indirect prompt injection, benchmarks, environmental and dark-pattern attacks, design-based defenses

### Takeaway
Indirect prompt injection through web content is the core, unsolved threat for browser agents. Benchmarks consistently show high partial-hijack rates. Model-level robustness reduces attack success but does not eliminate it, so the strongest guarantees come from system design: separating trusted control flow from untrusted data (CaMeL, dual-LLM, plan-then-execute) and avoiding the "lethal trifecta".

### Cited Findings
- **Greshake et al., "Not what you've signed up for" (2023, AISec '23)** introduced indirect prompt injection. Adversaries plant instructions in data the LLM retrieves (web pages, emails), turning LLM-integrated apps such as Bing Chat into vectors for data theft, worming, and manipulation. — [arXiv 2302.12173](https://arxiv.org/abs/2302.12173)
- **InjecAgent (Zhan et al., ACL Findings 2024)** has 1,054 test cases across 17 user tools and 62 attacker tools. A ReAct-prompted GPT-4 agent was vulnerable about 24% of the time, and attack success roughly doubled with an added "hacking prompt". — [arXiv 2403.02691](https://arxiv.org/abs/2403.02691)
- **AgentDojo (Debenedetti et al., NeurIPS 2024 D&B)** is an extensible environment with 97 realistic user tasks and 629 security test cases across email, banking, travel, and workspace suites. Attacks succeed against the best agents, and defenses trade off utility. It became the standard benchmark for defenses including CaMeL. — [arXiv 2406.13352](https://arxiv.org/abs/2406.13352)
- **EIA, Environmental Injection Attack (Liao et al., ICLR 2025)** injects malicious content, such as invisible form fields mimicking legitimate ones, into web pages to steal PII. Against a SeeAct-style GPT-4V agent on Mind2Web tasks, it reached up to 70% success at stealing specific PII and 16% at stealing the full user request. It is hard to detect because the injected elements can be visually unobtrusive. — [arXiv 2409.11295](https://arxiv.org/abs/2409.11295)
- **Pop-up attacks (Zhang, Yu, Yang, 2024, "Attacking Vision-Language Computer Agents via Pop-ups")**: adversarial pop-ups in OSWorld and VisualWebArena achieved about 86% average attack success and reduced task success by about 47%. Basic defenses such as telling the agent to ignore pop-ups were ineffective. — [arXiv 2411.02391](https://arxiv.org/abs/2411.02391)
- **WASP (Evtimov et al., Meta FAIR, 2025)** [verified] is an end-to-end web-agent prompt-injection benchmark. Attacks partially succeed (hijack the agent) in up to 86% of cases, yet agents often fail to complete the attacker's full goal, which the authors call "security by incompetence". Even top reasoning models are fooled by simple, low-effort human-written injections. — [arXiv 2504.18575](https://arxiv.org/abs/2504.18575)
- **CaMeL, "Defeating Prompt Injections by Design" (Debenedetti et al., Google DeepMind / ETH, 2025)** [verified] wraps the LLM in a protective system layer. It extracts control and data flow from the trusted user query only, so untrusted retrieved data cannot alter program flow, and it uses capabilities (data provenance tags) to enforce security policies at tool-call time and block exfiltration. It solves 77% of AgentDojo tasks with provable security, against 84% for an undefended system. The design uses a privileged LLM that writes code from the user query and a quarantined LLM that parses untrusted data without tool access (from the paper body, not the abstract). — [arXiv 2503.18813](https://arxiv.org/abs/2503.18813)
- **Design Patterns for Securing LLM Agents against Prompt Injections (Beurer-Kellner et al., 2025)** proposes six patterns: action-selector, plan-then-execute, LLM map-reduce, dual LLM, code-then-execute (CaMeL-like), and context-minimization. Core principle [verified via Willison]: "once an LLM agent has ingested untrusted input, it must be constrained." — [arXiv 2506.08837](https://arxiv.org/abs/2506.08837); [Simon Willison](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- **Simon Willison, "The lethal trifecta" (Jun 16, 2025)** [verified]: access to private data, exposure to untrusted content, and the ability to communicate externally. Together they let an attacker exfiltrate data. His advice is to avoid combining all three, because guardrails are unreliable, and "95% detection" is a failing grade in security. — [simonwillison.net](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- **Brave research on Comet and AI browsers (Aug and Oct 2025)**: the first disclosure showed that Perplexity Comet's page summarization could be hijacked by hidden instructions on a web page (for example in Reddit comments) to exfiltrate the user's account data. Brave argued that agentic browsers acting with the user's authenticated privileges make same-origin protections irrelevant. The follow-up "Unseeable prompt injections in screenshots" showed that faint or hidden text in images, which the screenshot pipeline extracts, injects instructions that bypass text sanitization. Fellou was also shown to treat visible page content as trusted, allowing navigation to Gmail and exfiltration. Perplexity's fixes were reportedly defeated (per Brave's update). — [Brave, Unseeable prompt injections](https://brave.com/blog/unseeable-prompt-injections/); [Simon Willison on Brave](https://simonwillison.net/2025/Oct/21/unseeable-prompt-injections/)

### Inferences
- Screenshot-based observation is not safer than DOM-based observation. Each has distinct injection channels: hidden DOM fields, aria labels, and off-screen text for DOM or accessibility-tree agents, and faint text or pop-ups for vision agents. Sanitization must cover every modality the model sees.
- A browser extension with the user's logged-in sessions inherently has all three trifecta legs. Mitigations must either break a leg (for example, restrict outbound navigation or form submission to user-approved domains during tasks that read sensitive data) or impose CaMeL-style control-flow separation.
- "Security by incompetence" will erode as agents get more capable, so defenses cannot rely on agents failing to complete attacker goals.

### Gaps
- I did not locate and verify the specific "dark patterns vs web agents" paper(s) within the tool budget. Pop-up and deceptive-UI attacks (above) are the closest verified-by-citation evidence. The report writer should treat dark-pattern-specific numbers as missing.
- Brave's first Comet post (Aug 2025) was not fetched directly. Its details here come from search summaries and Willison's coverage.

## Q4. Practical design recommendations from the literature

### Takeaway
The literature converges on these recommendations:
1. A hybrid observation (pruned accessibility tree or DOM with stable element refs, plus a screenshot) with element-ID actions, falling back to coordinates.
2. Aggressive observation and history minimization.
3. Explicit post-action verification and reflection.
4. A small, well-documented action set with high-level tools for hard widgets.
5. Independent success judging.
6. Layered safety: treat all page content as untrusted, gate consequential actions on human confirmation, scope site permissions, and separate trusted control flow from untrusted data.

### Cited Findings
- **Prune and rank page elements, then ground by ID or multiple choice.** Mind2Web's MindAct, WebLINX's Dense Markup Ranker, and Agent-E's DOM distillation all improve over raw HTML. — [Mind2Web](https://arxiv.org/abs/2306.06070); [WebLINX](https://arxiv.org/abs/2402.05930); [Agent-E](https://arxiv.org/abs/2407.13032)
- **Use a hybrid observation.** VisualWebArena's best agent combined SoM screenshots with the accessibility tree. SeeAct found textual element choices the best grounding method and SoM weak on dense pages. OSWorld offers screenshot + accessibility tree as an input mode, and higher resolution helps. — [VisualWebArena](https://arxiv.org/abs/2401.13649); [SeeAct](https://arxiv.org/abs/2401.01614); [OSWorld](http://osworld-v1.xlang.ai/)
- **Simplify the action space and keep history selective, with a note action for memory.** — [AgentOccam](https://arxiv.org/abs/2410.13825)
- **Report what changed after each action, and verify outcomes with a screenshot.** — [Agent-E](https://arxiv.org/abs/2407.13032); [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)
- **Limit screenshot history and prune in batches for cache efficiency.** Text history helps more than screenshot history. — [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool); [OSWorld](http://osworld-v1.xlang.ai/)
- **Prefer keyboard shortcuts for dropdowns, and expect filter, sort, and date failures.** — [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool); [Online-Mind2Web](https://arxiv.org/html/2504.01382)
- **Detect loops and repeated actions.** Failed runs are about 2x longer and full of repeated actions. — [Online-Mind2Web](https://arxiv.org/html/2504.01382)
- **Evaluate on live, hard tasks with an LLM judge (about 85 to 87% human agreement), not self-reported success.** — [Online-Mind2Web](https://arxiv.org/html/2504.01382)
- **Use human confirmation and takeover for purchases, publishing, sharing PII, and accepting terms.** Combine with site permissions and blocked categories. — [Claude for Chrome](https://claude.com/blog/claude-for-chrome); [OpenAI CUA](https://openai.com/index/computer-using-agent/); [Claude docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool)
- **Classify untrusted tool results and train for robustness, but assume residual risk (about 1% or more).** — [Anthropic prompt-injection defenses](https://www.anthropic.com/research/prompt-injection-defenses)
- **Use design-level isolation (CaMeL, dual-LLM, plan-then-execute) and avoid the lethal trifecta.** — [CaMeL](https://arxiv.org/abs/2503.18813); [Design patterns](https://arxiv.org/abs/2506.08837); [Willison](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- **Keep tools few, high-level, token-efficient, and well-described, with actionable errors.** — [Writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents); [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)

### Inferences
- For a Chrome extension specifically, the DOM and accessibility tree are cheaply available, so the default turn should be a compact accessibility-tree snapshot with ref IDs (cheap in tokens, precise to ground). Screenshots should be on demand or attached after state-changing actions for verification, which saves the 1 to 1.8K tokens per image.
- Plan-then-execute (a plan fixed from the user's request before reading untrusted pages) aligns both with planning benefits (Agent-E's hierarchical planner) and with injection resistance (the design-patterns paper). It is a good architectural default for multi-step tasks.

### Gaps
- No controlled study found, within budget, that directly compares accessibility-tree-only vs screenshot-only vs hybrid for frontier 2026 models. Most head-to-head comparisons are from the 2023 to 2024 GPT-4/4V era, and today's stronger vision models may have shifted the trade-off.
