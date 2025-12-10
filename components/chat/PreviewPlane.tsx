"use client";

import React, { useEffect, useState, useRef } from "react";
import { useWebContainer } from "@/lib/webcontainer";
import { Loader2, TerminalSquare, ExternalLink, Code, Zap } from "lucide-react";
import MonacoEditor from "./Editor";
import dynamic from "next/dynamic";

const XTerminal = dynamic(() => import("./Terminal"), { ssr: false });

interface FileItem {
    path: string;
    content: string;
    type?: string;
}

interface PreviewPaneProps {
    code: string;
}

function parseDep(raw: string): { name: string; version?: string } {
    const dep = raw.trim();
    if (!dep) return { name: "" };

    if (dep.startsWith("@")) {
        const lastAt = dep.lastIndexOf("@");
        if (lastAt > 0) {
            return {
                name: dep.slice(0, lastAt),
                version: dep.slice(lastAt + 1) || undefined,
            };
        }
        return { name: dep };
    }

    const [name, version] = dep.split("@");
    return { name, version: version || undefined };
}

function buildDepMap(list: string[] = []): Record<string, string> {
    const result: Record<string, string> = {};
    for (const raw of list) {
        const { name, version } = parseDep(raw);
        if (!name) continue;
        result[name] = version || "latest";
    }
    return result;
}

export default function PreviewPane({ code }: PreviewPaneProps) {
    const { webcontainer, isLoading: isBooting } = useWebContainer();
    const [url, setUrl] = useState<string>("");
    const [status, setStatus] = useState<
        "idle" | "mounting" | "installing" | "running" | "error"
    >("idle");
    const [parsedFiles, setParsedFiles] = useState<FileItem[]>([]);
    const [showCodeEditor, setShowCodeEditor] = useState(false);
    const [framework, setFramework] = useState<
        "react" | "expo" | "next" | "vite"
    >("react");
    const terminalHandleRef = useRef<any>(null);
    const xtermRef = useRef<any>(null);
    const processedCodeRef = useRef<string>("");

    useEffect(() => {
        if (terminalHandleRef.current?.terminal) {
            xtermRef.current = terminalHandleRef.current.terminal;
        }
    }, [terminalHandleRef.current?.terminal]);

    useEffect(() => {
        if (!webcontainer) return;
        if (!code) return;
        if (status === "installing" || status === "running") return;
        if (code === processedCodeRef.current) return;

        processedCodeRef.current = code;

        const runCode = async () => {
            const term = xtermRef.current;

            try {
                setStatus("mounting");
                setShowCodeEditor(true);

                if (term) {
                    term.writeln("");
                    term.writeln("\x1b[1;36m→\x1b[0m Parsing TOON JSON...");
                }

                // 1. Parse JSON
                const jsonMatch = code.match(/```json\n?([\s\S]*?)\n?```/);
                if (!jsonMatch) throw new Error("No JSON code block found");
                const toonJson = JSON.parse(jsonMatch[1]);

                let rawFw = toonJson.meta?.fw || "react";
                if (rawFw === "react-vite") rawFw = "vite";

                let detectedFramework: "react" | "expo" | "next" | "vite" =
                    "react";
                if (rawFw === "expo") detectedFramework = "expo";
                else if (rawFw === "next") detectedFramework = "next";
                else if (rawFw === "vite" || rawFw === "react")
                    detectedFramework = "vite";

                setFramework(detectedFramework);

                if (term) {
                    term.writeln(
                        `\x1b[1;35m→\x1b[0m Framework: ${detectedFramework}`
                    );
                }

                // 3. Extract Files
                const extractedFiles: FileItem[] = (toonJson.files || []).map(
                    (f: any) => ({ path: f.p, content: f.c, type: f.t })
                );
                setParsedFiles(extractedFiles);

                // 4. Build File Tree
                const files: Record<string, any> = {};
                for (const file of toonJson.files || []) {
                    const pathParts = file.p.split("/");
                    let current = files;
                    for (let i = 0; i < pathParts.length - 1; i++) {
                        const part = pathParts[i];
                        if (!current[part]) current[part] = { directory: {} };
                        current = current[part].directory;
                    }
                    current[pathParts[pathParts.length - 1]] = {
                        file: { contents: file.c },
                    };
                }

                const depsFromMeta: string[] = toonJson.meta?.deps || [
                    "react",
                    "react-dom",
                ];
                const optimizedDeps = buildDepMap(depsFromMeta);
                const devDepsFromMeta: string[] = toonJson.meta?.devDeps || [];
                const optimizedDevDeps = buildDepMap(devDepsFromMeta);

                if (
                    detectedFramework === "vite" ||
                    detectedFramework === "react"
                ) {
                    optimizedDeps["react"] ||= "latest";
                    optimizedDeps["react-dom"] ||= "latest";
                    optimizedDevDeps["vite"] ||= "latest";
                    optimizedDevDeps["@vitejs/plugin-react"] ||= "latest";
                }

                if (!files["package.json"]) {
                    const scripts: Record<string, string> =
                        toonJson.meta?.scripts || {};

                    if (!scripts.dev) {
                        if (detectedFramework === "next") {
                            scripts.dev = "next dev";
                            scripts.build = "next build";
                            scripts.start = "next start";
                        } else if (
                            detectedFramework === "vite" ||
                            detectedFramework === "react"
                        ) {
                            scripts.dev = "vite --host";
                            scripts.build = "vite build";
                            scripts.preview = "vite preview";
                        } else {
                            scripts.dev = "serve . || http-server .";
                        }
                    }

                    files["package.json"] = {
                        file: {
                            contents: JSON.stringify(
                                {
                                    name: "app",
                                    type: "module",
                                    scripts,
                                    dependencies: optimizedDeps,
                                    devDependencies: optimizedDevDeps,
                                },
                                null,
                                2
                            ),
                        },
                    };
                }

                if (
                    (detectedFramework === "vite" ||
                        detectedFramework === "react") &&
                    !files["vite.config.js"] &&
                    !files["vite.config.ts"]
                ) {
                    files["vite.config.js"] = {
                        file: {
                            contents: `import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react()] });`,
                        },
                    };
                }

                // 8. index.html
                if (!files["index.html"]) {
                    files["index.html"] = {
                        file: {
                            contents: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
                        },
                    };
                }

                if (term) {
                    term.writeln("\x1b[1;36m→\x1b[0m Mounting files...");
                }
                await webcontainer.mount(files);

                // 9. Install
                setStatus("installing");
                if (term) {
                    term.writeln(
                        "\x1b[1;33m→\x1b[0m Installing dependencies..."
                    );
                }

                const installProcess = await webcontainer.spawn(
                    "npm",
                    ["install"],
                    {
                        terminal: {
                            cols: term?.cols || 80,
                            rows: term?.rows || 24,
                        },
                    }
                );

                installProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            if (term) {
                                term.write(data);
                            }
                        },
                    })
                );

                const exitCode = await installProcess.exit;
                if (exitCode !== 0) {
                    throw new Error("Installation failed");
                }

                if (term) {
                    term.writeln("");
                    term.writeln("\x1b[1;32m✓\x1b[0m Dependencies installed");
                }

                // 10. Start Server
                setStatus("running");
                if (term) {
                    term.writeln("\x1b[1;36m→\x1b[0m Starting dev server...");
                    term.writeln("");
                }

                const devProcess = await webcontainer.spawn(
                    "npm",
                    ["run", "dev"],
                    {
                        terminal: {
                            cols: term?.cols || 80,
                            rows: term?.rows || 24,
                        },
                    }
                );

                devProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            if (term) {
                                term.write(data);
                            }
                        },
                    })
                );

                webcontainer.on("server-ready", (port, serverUrl) => {
                    if (term) {
                        term.writeln("");
                        term.writeln(
                            `\x1b[1;32m✓\x1b[0m Server ready at ${serverUrl}`
                        );
                        term.writeln("");
                    }
                    setUrl(serverUrl);
                    setTimeout(() => setShowCodeEditor(false), 800);
                });
            } catch (err) {
                console.error(err);
                setStatus("error");
                if (term) {
                    term.writeln("");
                    term.writeln(
                        `\x1b[1;31m✗\x1b[0m Error: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    );
                    term.writeln("");
                }
            }
        };

        runCode();
    }, [code, webcontainer, status]);

    const handleFileChange = async (path: string, newContent: string) => {
        setParsedFiles((prev) =>
            prev.map((f) =>
                f.path === path ? { ...f, content: newContent } : f
            )
        );

        if (webcontainer) {
            try {
                await webcontainer.fs.writeFile(path, newContent);

                // Log file change in terminal
                if (xtermRef.current) {
                    xtermRef.current.writeln(
                        `\x1b[2m[${new Date().toLocaleTimeString()}] File updated: ${path}\x1b[0m`
                    );
                }
            } catch (err) {
                console.error("Failed to write file:", err);
                if (xtermRef.current) {
                    xtermRef.current.writeln(
                        `\x1b[1;31m✗\x1b[0m Failed to write ${path}`
                    );
                }
            }
        }
    };

    if (isBooting) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Booting WebContainer...</p>
                <p className="text-xs text-slate-600 mt-2">
                    Initializing in-browser Node environment...
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
            {/* Navbar */}
            <div className="h-12 border-b border-slate-800 flex items-center px-4 bg-slate-900/50 space-x-3">
                <div className="flex space-x-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-700" />
                    <div className="w-3 h-3 rounded-full bg-slate-700" />
                </div>

                {parsedFiles.length > 0 && (
                    <button
                        onClick={() => setShowCodeEditor(!showCodeEditor)}
                        className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center space-x-1 transition-colors"
                    >
                        <Code size={14} />
                        <span>{showCodeEditor ? "Preview" : "Code"}</span>
                    </button>
                )}

                <div className="flex-1 bg-slate-950 rounded border border-slate-800 h-8 flex items-center px-3 text-xs text-slate-400 font-mono">
                    {url || "Waiting for server..."}
                </div>

                {status === "installing" && (
                    <div className="flex items-center space-x-1 text-xs text-emerald-500">
                        <Zap size={12} className="animate-pulse" />
                        <span>installing</span>
                    </div>
                )}

                {url && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <ExternalLink size={16} />
                    </a>
                )}
            </div>

            {/* Preview / Code */}
            <div className="flex-1 relative bg-white">
                {showCodeEditor ? (
                    <div className="h-full">
                        <MonacoEditor
                            files={parsedFiles}
                            isStreaming={
                                status === "mounting" || status === "installing"
                            }
                            framework={framework}
                            onFileChange={handleFileChange}
                        />
                    </div>
                ) : url ? (
                    <iframe
                        src={url}
                        className="w-full h-full border-none"
                        title="Preview"
                    />
                ) : (
                    <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-slate-500">
                        {status === "running" ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="animate-spin mb-2" />
                                <span>Starting server...</span>
                            </div>
                        ) : status === "installing" ? (
                            <div className="flex flex-col items-center space-y-3">
                                <Loader2
                                    className="animate-spin mb-2 text-emerald-500"
                                    size={32}
                                />
                                <span>Installing dependencies...</span>
                            </div>
                        ) : status === "mounting" ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="animate-spin mb-2" />
                                <span>Mounting files...</span>
                            </div>
                        ) : (
                            <span>Ready for code execution</span>
                        )}
                    </div>
                )}
            </div>

            {/* XTerm Terminal */}
            <div className="h-64 border-t border-slate-800 bg-black flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                        <TerminalSquare size={14} />
                        <span>Terminal</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-600 uppercase">
                            {status}
                        </span>
                    </div>
                </div>
                <XTerminal
                    ref={terminalHandleRef}
                    webcontainer={webcontainer}
                />
            </div>
        </div>
    );
}
