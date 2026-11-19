"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type { LoadedExample } from "@/lib/examples";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

    return (
        <div className="flex min-h-0 flex-1">
            {/* file explorer */}
            <nav className="w-60 shrink-0 overflow-auto border-r p-2 font-mono">
                <div className="mb-1 text-muted-foreground">explorer</div>
                <FileTree node={buildTree(example.files.map((f) => f.path))} current={current} onOpen={setCurrent} depth={0} />
            </nav>

            {/* code */}
            <section className="min-w-0 flex-1">
                <Editor
                    path={current}
                    value={file?.content ?? ""}
                    language={languageFor(current)}
                    theme="vs-dark"
                    onMount={onMount}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                />
            </section>

            {/* questions */}
            <aside className="w-[28rem] shrink-0 overflow-auto border-l p-3">
                {questions.map((q, qi) => {
                    const done = submitted[qi];
                    const answer = example.key.answers[qi];
                    const explanation = example.key.explanations?.[qi];
                    return (
                        <Card key={qi} className="mb-4 gap-2 px-4">
                            <div className="font-semibold">Question {qi + 1}</div>
                            <p className="whitespace-pre-wrap">{q.prompt}</p>

                            {q.kind === "locate" ? (
                                <div>
                                    {!done && (
                                        <div className="mb-1 flex flex-wrap gap-2">
                                            <Button size="sm" onClick={() => markSelection(qi)}>
                                                Mark selected lines
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setMarks((m) => m.map((v, i) => (i === qi ? "none" : v)))}>
                                                No defect
                                            </Button>
                                        </div>
                                    )}
                                    <p className="text-muted-foreground">
                                        {marks[qi] === null && "select the line(s) in the editor, then mark them"}
                                    </p>
                                    {marks[qi] === "none" && <p>your answer: no defect</p>}
                                    {marks[qi] && marks[qi] !== "none" && (
                                        <p>
                                            your answer:{" "}
                                            <button className="underline" onClick={() => jumpTo(marks[qi] as DefectLocation)}>
                                                {describe(marks[qi] as DefectLocation)}
                                            </button>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                q.choices.map((c, ci) => {
                                    const correct = done && ci === answer;
                                    const wrong = done && picked[qi] === ci && ci !== answer;
                                    return (
                                        <label
                                            key={ci}
                                            className={`flex gap-2 rounded-md px-2 py-1 ${correct ? "bg-green-500/15" : ""} ${wrong ? "bg-red-500/15" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name={`q${qi}`}
                                                checked={picked[qi] === ci}
                                                disabled={done}
                                                onChange={() => setPicked((p) => p.map((v, i) => (i === qi ? ci : v)))}
                                            />
                                            <span>{String.fromCharCode(65 + ci)}. {c}</span>
                                        </label>
                                    );
                                })
                            )}

                            {!done ? (
                                <Button
                                    className="w-fit"
                                    disabled={!canSubmit(qi)}
                                    onClick={() => setSubmitted((s) => s.map((v, i) => (i === qi ? true : v)))}
                                >
                                    Submit
                                </Button>
                            ) : (
                                <div className="border-t pt-2">
                                    <Badge variant={isCorrect(qi) ? "default" : "destructive"}>{isCorrect(qi) ? "Correct" : "Incorrect"}</Badge>
                                    {typeof answer === "number" ? (
                                        !isCorrect(qi) && <p>the answer is {String.fromCharCode(65 + answer)}</p>
                                    ) : answer.defect ? (
                                        <p>
                                            the defect is at{" "}
                                            <button className="underline" onClick={() => jumpTo(answer.defect!)}>
                                                {describe(answer.defect)}
                                            </button>
                                        </p>
                                    ) : (
                                        <p>there is no defect in this code</p>
                                    )}
                                    {explanation && <p className="mt-1 whitespace-pre-wrap">{explanation}</p>}
                                </div>
                            )}
                        </Card>
                    );
                })}
                <div className="flex items-center gap-3">
                    <span>score: {score}/{doneCount} submitted ({questions.length} total)</span>
                    {doneCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setPicked(questions.map(() => null));
                                setMarks(questions.map(() => null));
                                setSubmitted(questions.map(() => false));
                            }}
                        >
                            Reset
                        </Button>
                    )}
                </div>
            </aside>
        </div>
    );
}

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
                            style={{ paddingLeft: depth * 12 + 16 }}
                            className={`block w-full truncate pr-1 text-left rounded-sm ${child.path === current ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                        >
                            {child.name}
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
                style={{ paddingLeft: depth * 12 }}
                className="block w-full truncate rounded-sm pr-1 text-left hover:bg-muted"
            >
                {open ? "▾" : "▸"} {node.name}/
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
