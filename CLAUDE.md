# readcode

Code-reading practice for backend interviews: job postings → topic plans → example bank → web viewer.

## Flow
1. `golden_list/backend_jobs.json`: 94 postings (`scripts/collect_jobs.py` scraped them; descriptions were partly pasted by hand, so rerunning loses them).
2. Classify each posting against the taxonomy (`pipeline/taxonomy/v0.1.0.json`, prompt in `pipeline/src/classifier.ts`) → `golden_list/plans/weights/NNN.json` → `plansFromWeights.ts` → `plans/NNN.json` (NNN = 1-based posting index). `plans/master.json` = 75th percentile of each topic's count across the plans (224 examples).
3. `pipeline/src/generateBank.ts` turns the master plan into `examples/NNN-<topic>/` (`public.json`, `key.json`, `src/**`).
4. `web/` (Next.js) reads `examples/` and `golden_list/` from disk. Run: `cd web && npm run dev`.

## Example format
- Schema: `shared/types.ts` (zod). `ExamplePublic` is shown to the candidate; `ExampleKey` holds the answers and explanations.
- Two exercise types, tagged in the UI (`exerciseKind()` in `shared/types.ts`):
  - **Comprehension** (the generated bank): 4 questions. Q1 is "locate the defect" (line range, or no defect); Q2–4 are multiple choice.
  - **Bug fix** (225–234, `demo-fix-pagination`): 1 runnable `fix` question. The candidate edits the listed files and runs 6–8 `node --test` tests (local dev only, `web/lib/runTests.ts`); correct = all tests pass.
- The prompt (`SYSTEM_PROMPT` in `pipeline/src/exampleGenerator.ts`) does most of the work. The model returns a `Draft`, and `exampleFromDraft` validates it and converts it to the schema (e.g. the quoted defect snippet becomes a line range).

## Changing the question format = 3 places
1. Schema: `shared/types.ts`
2. Prompt + draft schema + `exampleFromDraft`: `pipeline/src/exampleGenerator.ts`
3. Renderer: `web/app/examples/[name]/ExampleViewer.tsx`

Then regenerate the examples, or migrate the existing ones.

## Generating without the API
There's no API key; Claude Code subagents act as the model.
`generateBank.ts --mode prepare` writes the jobs to `examples/.work/jobs/`. Subagents follow `examples/.work/INSTRUCTIONS.md` and write drafts to `examples/.work/drafts/`. `--mode assemble` validates the drafts and writes the examples. `.work/` is gitignored.

## Known gaps
- No one has reviewed the examples for correctness, and some defect patterns repeat within topics.
- Not built yet: a no-reuse registry, sourcing from open-source repos, runnable examples, free-text answers with model grading, saved progress.
- Examples live as files in git for now; a database is planned once the schema settles.
