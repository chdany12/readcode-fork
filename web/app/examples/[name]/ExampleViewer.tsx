"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type { LoadedExample } from "@/lib/examples";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ChevronDown, FileCode, RotateCcw, TextSelect, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeFont } from "@/lib/fonts";
import type { DefectLocation, LocateAnswer } from "../../../../shared/types";

type MonacoEditor = Parameters<OnMount>[0];
type Decorations = ReturnType<MonacoEditor["createDecorationsCollection"]>;

// A candidate's answer to a locate question: marked lines, "no defect", or nothing yet.
type LocateMark = DefectLocation | "none" | null;

// A marked range counts as correct if it overlaps the defect, allowing this many lines either side.
const LINE_TOLERANCE = 1;

// NOTE: the answer key is sent to the browser. Fine for a prototype, not for real use.
export default function ExampleViewer({ example }: { example: LoadedExample }) {
    const [current, setCurrent] = useState(example.files[0]?.path ?? "");
    const questions = example.public.questions;
    const [picked, setPicked] = useState<(number | null)[]>(questions.map(() => null));
    const [marks, setMarks] = useState<LocateMark[]>(questions.map(() => null));
    const [submitted, setSubmitted] = useState<boolean[]>(questions.map(() => false));

    const editorRef = useRef<MonacoEditor | null>(null);
    const decorationsRef = useRef<Decorations | null>(null);
    const [editorReady, setEditorReady] = useState(false);

    const file = example.files.find((f) => f.path === current);
    const isCorrect = (qi: number) => {
        const answer = example.key.answers[qi];
        return typeof answer === "number" ? picked[qi] === answer : locateCorrect(marks[qi], answer);
    };
    const doneCount = submitted.filter(Boolean).length;
    const score = questions.filter((_, qi) => submitted[qi] && isCorrect(qi)).length;

    // Highlight, in the open file: the candidate's marked lines, and after submission the actual defect.
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !editorReady) return;
        const ranges: { range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; options: { isWholeLine: boolean; className: string } }[] = [];
        questions.forEach((q, qi) => {
            if (q.kind !== "locate") return;
            const mark = marks[qi];
            if (mark && mark !== "none" && mark.path === current) {
                ranges.push(lineRange(mark, "rc-marked"));
            }
            const answer = example.key.answers[qi];
            if (submitted[qi] && typeof answer !== "number" && answer.defect && answer.defect.path === current) {
                ranges.push(lineRange(answer.defect, "rc-defect"));
            }
        });
        if (!decorationsRef.current) decorationsRef.current = editor.createDecorationsCollection(ranges);
        else decorationsRef.current.set(ranges);
    }, [current, marks, submitted, editorReady, questions, example.key.answers]);

    const onMount: OnMount = (editor) => {
        editorRef.current = editor;
        setEditorReady(true);
    };

    // Mark the lines currently selected in the editor (or the cursor's line) for question qi.
    const markSelection = (qi: number) => {
        const sel = editorRef.current?.getSelection();
        if (!sel) return;
        let endLine = sel.endLineNumber;
        if (sel.endColumn === 1 && endLine > sel.startLineNumber) endLine--; // selection ending at a line start
        const mark: DefectLocation = { path: current, startLine: sel.startLineNumber, endLine };
        setMarks((m) => m.map((v, i) => (i === qi ? mark : v)));
    };

    const jumpTo = (loc: DefectLocation) => {
        setCurrent(loc.path);
        // after the editor switches files, scroll to the range
        setTimeout(() => editorRef.current?.revealLinesInCenter(loc.startLine, loc.endLine), 0);
    };

    const canSubmit = (qi: number) => (questions[qi].kind === "locate" ? marks[qi] !== null : picked[qi] !== null);

    const reset = () => {
        setPicked(questions.map(() => null));
        setMarks(questions.map(() => null));
        setSubmitted(questions.map(() => false));
    };
    const submit = (qi: number) => setSubmitted((s) => s.map((v, i) => (i === qi ? true : v)));

    return (
        <div className="flex min-h-0 flex-1">
            {/* files */}
            <nav className={cn("w-56 shrink-0 overflow-auto border-r py-3 text-[13px]", codeFont.className)} aria-label="Files">
                <div className="mb-2 px-3 font-sans text-xs font-medium text-muted-foreground">Files</div>
                <FileTree node={buildTree(example.files.map((f) => f.path))} current={current} onOpen={setCurrent} depth={0} />
            </nav>

            {/* code */}
            <section className="min-w-0 flex-1">
                <Editor
                    path={current}
                    value={file?.content ?? ""}
                    language={languageFor(current)}
                    theme="readcode-dark"
                    beforeMount={defineTheme}
                    onMount={onMount}
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        scrollBeyondLastLine: false,
                        renderLineHighlight: "none",
                        padding: { top: 12 },
                    }}
                />
            </section>

            {/* questions */}
            <aside className="flex w-[28rem] shrink-0 flex-col border-l">
                {/* progress */}
                <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                            {doneCount} of {questions.length} answered{doneCount > 0 && <> · <span className="text-foreground">{score} correct</span></>}
                        </span>
                        {doneCount > 0 && (
                            <Button variant="ghost" size="xs" onClick={reset} className="text-muted-foreground">
                                <RotateCcw /> Reset
                            </Button>
                        )}
                    </div>
                    <div className="mt-2 flex gap-1">
                        {questions.map((_, qi) => (
                            <span
                                key={qi}
                                className={cn(
                                    "h-1 flex-1 rounded-full",
                                    !submitted[qi] ? "bg-muted" : isCorrect(qi) ? "bg-emerald-500" : "bg-red-500",
                                )}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex-1 space-y-3 overflow-auto p-4">
                    {questions.map((q, qi) => {
                        const done = submitted[qi];
                        const answer = example.key.answers[qi];
                        const explanation = example.key.explanations?.[qi];
                        const correct = done && isCorrect(qi);
                        return (
                            <Card key={qi} className={cn("gap-3 px-4 py-4", done && (correct ? "ring-emerald-500/40" : "ring-red-500/40"))}>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        <span className="font-medium text-foreground">Q{qi + 1}</span> · {q.kind === "locate" ? "Find the defect" : "Multiple choice"}
                                    </span>
                                    {done && (
                                        <span className={cn("flex items-center gap-1 font-medium", correct ? "text-emerald-400" : "text-red-400")}>
                                            {correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                                            {correct ? "Correct" : "Incorrect"}
                                        </span>
                                    )}
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{q.prompt}</p>

                                {q.kind === "locate" ? (
                                    <div className="space-y-2">
                                        {!done && (
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => markSelection(qi)}>
                                                    <TextSelect /> Mark selected lines
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setMarks((m) => m.map((v, i) => (i === qi ? "none" : v)))}>
                                                    No defect
                                                </Button>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {marks[qi] === null && "Select line(s) in the editor, then mark them."}
                                            {marks[qi] === "none" && "Your answer: no defect"}
                                            {marks[qi] && marks[qi] !== "none" && (
                                                <>
                                                    Your answer:{" "}
                                                    <button className="text-foreground underline underline-offset-2" onClick={() => jumpTo(marks[qi] as DefectLocation)}>
                                                        {describe(marks[qi] as DefectLocation)}
                                                    </button>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5" role="radiogroup">
                                        {q.choices.map((c, ci) => {
                                            const selected = picked[qi] === ci;
                                            const isAnswer = done && ci === answer;
                                            const isWrongPick = done && selected && ci !== answer;
                                            return (
                                                <button
                                                    key={ci}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    disabled={done}
                                                    onClick={() => setPicked((p) => p.map((v, i) => (i === qi ? ci : v)))}
                                                    className={cn(
                                                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                                                        !done && (selected ? "border-foreground/60 bg-muted" : "hover:border-foreground/30 hover:bg-muted/40"),
                                                        isAnswer && "border-emerald-500/60 bg-emerald-500/10",
                                                        isWrongPick && "border-red-500/60 bg-red-500/10",
                                                        done && !isAnswer && !isWrongPick && "opacity-60",
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "mt-px flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-medium",
                                                            selected && !done && "border-foreground bg-foreground text-background",
                                                        )}
                                                    >
                                                        {String.fromCharCode(65 + ci)}
                                                    </span>
                                                    <span className="leading-snug">{c}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {!done ? (
                                    <Button size="sm" className="w-fit" disabled={!canSubmit(qi)} onClick={() => submit(qi)}>
                                        Submit
                                    </Button>
                                ) : (
                                    <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-[13px] leading-relaxed">
                                        {typeof answer === "number" ? (
                                            !correct && <p className="font-medium">The answer is {String.fromCharCode(65 + answer)}.</p>
                                        ) : answer.defect ? (
                                            <p className="font-medium">
                                                The defect is at{" "}
                                                <button className="underline underline-offset-2" onClick={() => jumpTo(answer.defect!)}>
                                                    {describe(answer.defect)}
                                                </button>
                                                .
                                            </p>
                                        ) : (
                                            <p className="font-medium">There is no defect in this code.</p>
                                        )}
                                        {explanation && <p className="whitespace-pre-wrap text-muted-foreground">{explanation}</p>}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </aside>
        </div>
    );
}

// Editor theme matching the page: the app's dark background, no line-highlight box.
const defineTheme: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("readcode-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
            "editor.background": "#0a0a0a",
            "editorGutter.background": "#0a0a0a",
            "editorLineNumber.foreground": "#525252",
            "editorLineNumber.activeForeground": "#a3a3a3",
        },
    });
};

function locateCorrect(mark: LocateMark, answer: LocateAnswer): boolean {
    if (mark === null) return false;
    if (answer.defect === null) return mark === "none";
    if (mark === "none" || mark.path !== answer.defect.path) return false;
    return mark.startLine <= answer.defect.endLine + LINE_TOLERANCE && mark.endLine >= answer.defect.startLine - LINE_TOLERANCE;
}

function describe(loc: DefectLocation): string {
    return loc.startLine === loc.endLine ? `${loc.path} line ${loc.startLine}` : `${loc.path} lines ${loc.startLine}–${loc.endLine}`;
}

function lineRange(loc: DefectLocation, className: string) {
    return {
        range: { startLineNumber: loc.startLine, startColumn: 1, endLineNumber: loc.endLine, endColumn: 1 },
        options: { isWholeLine: true, className },
    };
}

// ---- file tree ----

type TreeNode = { name: string; path: string; children: TreeNode[]; isFile: boolean };

// Turn flat paths ("a/b/c.ts") into a folder tree. Folders first, then files, alphabetical.
function buildTree(paths: string[]): TreeNode {
    const root: TreeNode = { name: "", path: "", children: [], isFile: false };
    for (const p of paths) {
        let node = root;
        p.split("/").forEach((part, i, parts) => {
            const isFile = i === parts.length - 1;
            let child = node.children.find((c) => c.name === part && c.isFile === isFile);
            if (!child) {
                child = { name: part, path: parts.slice(0, i + 1).join("/"), children: [], isFile };
                node.children.push(child);
            }
            node = child;
        });
    }
    const sort = (n: TreeNode) => {
        n.children.sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
        n.children.forEach(sort);
    };
    sort(root);
    return root;
}

function FileTree({ node, current, onOpen, depth }: {
    node: TreeNode; current: string; onOpen: (path: string) => void; depth: number;
}) {
    return (
        <ul>
            {node.children.map((child) =>
                child.isFile ? (
                    <li key={child.path}>
                        <button
                            onClick={() => onOpen(child.path)}
                            title={child.path}
                            style={{ paddingLeft: depth * 12 + 12 }}
                            className={cn(
                                "flex w-full items-center gap-1.5 truncate py-1 pr-2 text-left",
                                child.path === current ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            )}
                        >
                            <FileCode className="size-3.5 shrink-0" />
                            <span className="truncate">{child.name}</span>
                        </button>
                    </li>
                ) : (
                    <Folder key={child.path} node={child} current={current} onOpen={onOpen} depth={depth} />
                ),
            )}
        </ul>
    );
}

function Folder({ node, current, onOpen, depth }: {
    node: TreeNode; current: string; onOpen: (path: string) => void; depth: number;
}) {
    const [open, setOpen] = useState(true);
    return (
        <li>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{ paddingLeft: depth * 12 + 8 }}
                className="flex w-full items-center gap-1 truncate py-1 pr-2 text-left text-muted-foreground hover:text-foreground"
            >
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
                {node.name}
            </button>
            {open && <FileTree node={node} current={current} onOpen={onOpen} depth={depth + 1} />}
        </li>
    );
}

function languageFor(p: string): string {
    const ext = p.split(".").pop() ?? "";
    const map: Record<string, string> = {
        ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python", go: "go",
        java: "java", rs: "rust", rb: "ruby", cs: "csharp", kt: "kotlin", json: "json", sql: "sql",
        yml: "yaml", yaml: "yaml", md: "markdown", sh: "shell",
    };
    return map[ext] ?? "plaintext";
}
