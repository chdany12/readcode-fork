// ============================================================================
// exampleGenerator.ts — Pipeline step 5+: generate one code-reading example
// ----------------------------------------------------------------------------
// NOTE: This file was AI-generated (Claude, via Claude Code). Read it with
// that in mind before relying on or changing it.
//
// Role:
//   Given a target concept (a taxonomy label), asks Claude to write a small,
//   self-contained code example plus 4 questions about it, and returns a
//   validated Example. Question 1 is open-ended "locate the defect": the
//   candidate marks the defective lines, or answers that there is no defect.
//   Questions 2-4 are multiple choice. Every question has an explanation,
//   shown after the candidate submits it. writeExample() puts it on disk:
//
//     <outDir>/public.json   questions and metadata (what the candidate sees)
//     <outDir>/key.json      answers and explanations
//     <outDir>/src/...       the example's code files
//
// Defect or not:
//   This file decides (randomly, NO_DEFECT_RATE) whether the example has a
//   defect, so "no defect" is sometimes the right answer and the question
//   itself gives nothing away. The model quotes the defective code exactly;
//   this file turns that quote into a line range, since models miscount lines.
//
// Stand-in for now:
//   The pipeline's steps 6–10 (anchor file from an open-source repo, scrape,
//   self-contain, inject bugs, compile) are not built yet. Until then Claude
//   writes the code from scratch, guided by the prompt below.
//
// Split of responsibility:
//   Claude writes the creative parts (code, questions, answers, concepts).
//   This file fills in what the model must not decide: id, createdAt,
//   taxonomyVersion, defect presence, line numbers, and that the target
//   concept is always in `concepts`.
// ============================================================================

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { Example, type DefectLocation, type LabelId, type Taxonomy } from "../../shared/types.ts";
import { logUsage } from "./usage.ts";

const MODEL = "claude-opus-5-5";
const CHOICE_QUESTION_COUNT = 3;   // plus one locate question = 4
const CHOICES_PER_QUESTION = 4;
const NO_DEFECT_RATE = 0.25;       // share of examples with no defect

export const SYSTEM_PROMPT = `You write code-reading exercises for backend engineers preparing for a specific job.

A candidate reads a short, realistic piece of production-style code and answers questions about it. The exercise trains reading and reasoning about real code, not writing it.

The code:
- Centers on the target concept: understanding that concept must be necessary to answer the questions.
- Looks like real production code from a backend service: realistic names, structure, and error handling. Not a textbook snippet.
- Is self-contained: 1 to 4 files, roughly 80 to 250 lines in total. Files may import each other and the language's standard library or very common libraries, nothing else.
- Has no comments that give away answers.

The defect (the user message says whether to include one):
- When asked to include a defect: exactly one subtle, realistic defect related to the target concept, the kind that passes code review and causes trouble in production (for example a race condition, a missing timeout, a retry without idempotency). It must be findable by careful reading. Do not mark or hint at it anywhere.
- When asked for no defect: the code must be correct with respect to the target concept and free of other real defects. It should still look like code that might have one, so it is a fair test.
- Report the defect separately: the file path, and a snippet copied exactly, character for character, from that file covering the defective line or lines (as few lines as possible, at most 6). The snippet must appear exactly once in the file. Report null when there is no defect.

The locate question:
- A neutral prompt asking the candidate to find the defect if there is one, for example "Is there a defect in how this code handles <concern>? If so, mark the line(s) where it is; otherwise answer that there is none." Use the same kind of wording whether or not a defect exists, and never imply that one does.
- Its explanation says where the defect is and what goes wrong because of it (or, with no defect, why the code is correct where it looks risky).

The multiple-choice questions:
- Exactly ${CHOICE_QUESTION_COUNT}, each with exactly ${CHOICES_PER_QUESTION} choices and exactly one correct choice.
- Answerable from the code alone, by careful reading.
- Ask about behavior, failure modes, consequences under load or failure, or design tradeoffs. Not syntax, trivia, or naming.
- They must not reveal whether the code has a defect or where it is: no question about "the bug", its fix, or its consequences. The candidate may answer them before the locate question.
- Wrong choices are plausible to someone who skims.
- Vary the position of the correct choice across questions.

Explanations:
- Every question gets an explanation, shown to the candidate right after they submit that question.
- For multiple choice: why the correct choice is right, pointing to the specific code, and briefly why each wrong choice is wrong.
- Each explanation must stand alone and must not give away the answer to another question; in particular, multiple-choice explanations must not reveal the defect.

Also report:
- concepts: the target concept plus any other listed labels the example genuinely exercises. Only include a label if a question depends on it or the code meaningfully demonstrates it.
- name: a short, plain name for the example, 2 to 4 words, that says what the code does without hinting at any defect (for example "Carrier label adapter", "Order event consumer").
- durationMinutes: a realistic time to read the code and answer all questions.

If the user message gives a <scenario>, set the code in that business domain.`;

// What Claude returns. Array sizes are checked in code after parsing,
// since structured outputs don't enforce exact lengths.
export function draftSchema(taxonomy: Taxonomy) {
    return z.object({
        title: z.string(),
        name: z.string(),
        language: z.string(),
        durationMinutes: z.number(),
        files: z.array(z.object({ path: z.string(), content: z.string() })),
        defect: z.object({ path: z.string(), snippet: z.string() }).nullable(),
        locateQuestion: z.object({ prompt: z.string(), explanation: z.string() }),
        choiceQuestions: z.array(
            z.object({
                prompt: z.string(),
                choices: z.array(z.string()),
                answer: z.number(), // index into choices
                explanation: z.string(),
            }),
        ),
        concepts: z.array(z.enum(taxonomy.labels as [string, ...string[]])),
    });
}

const client = new Anthropic(); // ANTHROPIC_API_KEY, or an `ant auth login` profile

export interface GenerateOptions {
    language?: string;        // default TypeScript
    jobDescription?: string;  // optional, gives the example the role's domain flavor
    withDefect?: boolean;     // default: random, true with probability 1 - NO_DEFECT_RATE
    scenario?: string;        // optional business domain for the code, to vary examples of the same concept
}

export type Draft = z.infer<ReturnType<typeof draftSchema>>;

// Decide defect presence and build the user message. Separate so drafts can be produced outside the API.
export function prepareRequest(topic: LabelId, taxonomy: Taxonomy, options: GenerateOptions = {}): { withDefect: boolean; userContent: string } {
    if (!taxonomy.labels.includes(topic)) {
        throw new Error(`Topic ${topic} is not in taxonomy v${taxonomy.version}`);
    }
    const language = options.language ?? "TypeScript";
    const withDefect = options.withDefect ?? Math.random() >= NO_DEFECT_RATE;
    const userContent = [
        `<target_concept>${topic}</target_concept>`,
        `<language>${language}</language>`,
        `<defect>${withDefect ? "include exactly one defect" : "no defect: the code must be correct"}</defect>`,
        `<labels>\n${taxonomy.labels.join("\n")}\n</labels>`,
        options.scenario ? `<scenario>${options.scenario}</scenario>` : "",
        options.jobDescription ? `<posting>\n${options.jobDescription}\n</posting>` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    return { withDefect, userContent };
}

// Generate via the Claude API.
export async function generateExample(
    topic: LabelId,
    taxonomy: Taxonomy,
    options: GenerateOptions = {},
): Promise<Example> {
    const { withDefect, userContent } = prepareRequest(topic, taxonomy, options);

    // streamed: a large max_tokens on a non-streaming call is refused by the SDK (10-minute limit)
    const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // on a safety refusal, the API re-runs on a fallback model
        output_config: { format: betaZodOutputFormat(draftSchema(taxonomy)), effort: "medium" },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
    });
    const response = await stream.finalMessage(); // includes parsed_output, like messages.parse

    logUsage("generateExample", response.usage);

    if (response.stop_reason === "refusal") {
        throw new Error(`Example generation refused (${response.stop_details?.category ?? "unknown"})`);
    }
    if (response.stop_reason === "max_tokens") {
        throw new Error("Example generation hit max_tokens before finishing");
    }
    const draft = response.parsed_output;
    if (!draft) throw new Error("Example generation returned no parseable output");
    return exampleFromDraft(draft, topic, taxonomy, withDefect);
}

// Validate a draft (from the API or produced elsewhere) and turn it into an Example.
export function exampleFromDraft(rawDraft: unknown, topic: LabelId, taxonomy: Taxonomy, withDefect: boolean): Example {
    const draft = draftSchema(taxonomy).parse(rawDraft);

    // checks the schema couldn't enforce
    if (draft.files.length === 0) throw new Error("Example has no files");
    const files = draft.files.map((f) => ({ path: normalizePath(f.path), content: f.content }));
    files.forEach((f) => assertSafeRelativePath(f.path));

    if (draft.choiceQuestions.length !== CHOICE_QUESTION_COUNT) {
        throw new Error(`Expected ${CHOICE_QUESTION_COUNT} multiple-choice questions, got ${draft.choiceQuestions.length}`);
    }
    draft.choiceQuestions.forEach((q, i) => {
        if (q.choices.length < 2) throw new Error(`Question ${i + 2} has fewer than 2 choices`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) {
            throw new Error(`Question ${i + 2} has answer index ${q.answer} out of range`);
        }
    });

    if (withDefect !== (draft.defect !== null)) {
        throw new Error(withDefect ? "Asked for a defect but none was reported" : "Asked for no defect but one was reported");
    }
    const defect = draft.defect ? locateSnippet(files, normalizePath(draft.defect.path), draft.defect.snippet) : null;

    return Example.parse({
        public: {
            id: randomUUID(),
            title: draft.title,
            name: draft.name,
            createdAt: new Date().toISOString(),
            durationMinutes: Math.max(1, Math.round(draft.durationMinutes)),
            language: draft.language,
            questions: [
                { kind: "locate", prompt: draft.locateQuestion.prompt },
                ...draft.choiceQuestions.map(({ prompt, choices }) => ({ kind: "choice", prompt, choices })),
            ],
            taxonomyVersion: taxonomy.version,
            concepts: [...new Set([topic, ...draft.concepts])], // target always first, no duplicates
        },
        key: {
            answers: [{ defect }, ...draft.choiceQuestions.map((q) => q.answer)],
            explanations: [draft.locateQuestion.explanation, ...draft.choiceQuestions.map((q) => q.explanation)],
        },
        files,
    });
}

// Turn the model's quoted snippet into a 1-based inclusive line range.
function locateSnippet(files: { path: string; content: string }[], filePath: string, snippet: string): DefectLocation {
    const file = files.find((f) => f.path === filePath);
    if (!file) throw new Error(`Defect is in ${filePath}, which is not one of the example's files`);
    const needle = snippet.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
    if (needle.trim() === "") throw new Error("Defect snippet is empty");
    const content = file.content.replace(/\r\n/g, "\n");
    const at = content.indexOf(needle);
    if (at < 0) throw new Error(`Defect snippet not found in ${filePath}`);
    if (content.indexOf(needle, at + 1) >= 0) throw new Error(`Defect snippet appears more than once in ${filePath}`);
    const startLine = content.slice(0, at).split("\n").length;
    const endLine = startLine + needle.split("\n").length - 1;
    return { path: filePath, startLine, endLine };
}

// Write an example to disk: public.json, key.json, src/<files>.
export async function writeExample(example: Example, outDir: string): Promise<void> {
    example.files.forEach((f) => assertSafeRelativePath(f.path)); // check all before writing anything
    const srcDir = path.resolve(outDir, "src");
    await mkdir(srcDir, { recursive: true });

    await writeFile(path.join(outDir, "public.json"), JSON.stringify(example.public, null, 2) + "\n");
    await writeFile(path.join(outDir, "key.json"), JSON.stringify(example.key, null, 2) + "\n");

    for (const file of example.files) {
        const target = path.resolve(srcDir, file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content);
    }
}

function normalizePath(p: string): string {
    return path.posix.normalize(p.replaceAll("\\", "/")).replace(/^\.\//, "");
}

// File paths come from the model: keep them inside src/.
function assertSafeRelativePath(p: string): void {
    const normalized = path.posix.normalize(p.replaceAll("\\", "/"));
    if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../") || normalized === ".") {
        throw new Error(`Unsafe example file path: ${p}`);
    }
}
