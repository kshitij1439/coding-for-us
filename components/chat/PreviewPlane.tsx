"use client";

import React, { useEffect, useState, useRef } from "react";
import { useWebContainer } from "@/lib/webcontainer";
import { Loader2, TerminalSquare, ExternalLink, Code, Zap } from "lucide-react";
import MonacoEditor from "./Editor";

interface FileItem {
    path: string;
    content: string;
    type?: string;
}

interface PreviewPaneProps {
    code: string;
}

// Helper: parse "react@18.2.0" or "@scope/pkg@1.2.3"
function parseDep(raw: string): { name: string; version?: string } {
    const dep = raw.trim();
    if (!dep) return { name: "" };

    // Scoped packages: @scope/name[@version]
    if (dep.startsWith("@")) {
        const lastAt = dep.lastIndexOf("@");
        // If there's a second '@' (position > 0), treat it as version delimiter
        if (lastAt > 0) {
            return {
                name: dep.slice(0, lastAt),
                version: dep.slice(lastAt + 1) || undefined,
            };
        }
        return { name: dep };
    }

    // Non-scoped: name[@version]
    const [name, version] = dep.split("@");
    return { name, version: version || undefined };
}

// Helper: convert ["react@18", "next", "@scope/pkg@1.0.0"]
// to { react: "18", next: "latest", "@scope/pkg": "1.0.0" }
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
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<
        "idle" | "mounting" | "installing" | "running" | "error"
    >("idle");
    const [parsedFiles, setParsedFiles] = useState<FileItem[]>([]);
    const [showCodeEditor, setShowCodeEditor] = useState(false);
    const [framework, setFramework] = useState<
        "react" | "expo" | "next" | "vite"
    >("react");

    const processedCodeRef = useRef<string>("");

    const addLog = (line: string) => {
        setLogs((prev) => [
            ...prev.slice(-50),
            `${new Date().toLocaleTimeString()}: ${line}`,
        ]);
    };

    useEffect(() => {
        if (!webcontainer) return;
        if (!code) return;
        if (status === "installing" || status === "running") return;
        if (code === processedCodeRef.current) return;

        processedCodeRef.current = code;

        const runCode = async () => {
            try {
                setStatus("mounting");
                setShowCodeEditor(true);
                addLog("🔍 Parsing TOON JSON...");

                // 1. Parse JSON
                const jsonMatch = code.match(/```json\n?([\s\S]*?)\n?```/);
                if (!jsonMatch) throw new Error("No JSON code block found");
                const toonJson = JSON.parse(jsonMatch[1]);

                // 2. Robust Framework Detection
                // If meta.fw says "react", we usually want "vite" behavior for the web container
                let rawFw = toonJson.meta?.fw || "react";
                if (rawFw === "react-vite") rawFw = "vite";

                let detectedFramework: "react" | "expo" | "next" | "vite" =
                    "react";
                if (rawFw === "expo") detectedFramework = "expo";
                else if (rawFw === "next") detectedFramework = "next";
                else if (rawFw === "vite" || rawFw === "react")
                    detectedFramework = "vite"; // Treat "react" as "vite"

                setFramework(detectedFramework);
                addLog(`📱 Framework: ${detectedFramework}`);

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

                // 5. Dependency Management
                const depsFromMeta: string[] = toonJson.meta?.deps || [
                    "react",
                    "react-dom",
                ];
                const optimizedDeps = buildDepMap(depsFromMeta);
                const devDepsFromMeta: string[] = toonJson.meta?.devDeps || [];
                const optimizedDevDeps = buildDepMap(devDepsFromMeta);

                // Ensure critical deps exist based on framework
                if (
                    detectedFramework === "vite" ||
                    detectedFramework === "react"
                ) {
                    optimizedDeps["react"] ||= "latest";
                    optimizedDeps["react-dom"] ||= "latest";
                    optimizedDevDeps["vite"] ||= "latest";
                    optimizedDevDeps["@vitejs/plugin-react"] ||= "latest";
                }

                // 6. Generate package.json if missing
                if (!files["package.json"]) {
                    const scripts: Record<string, string> =
                        toonJson.meta?.scripts || {};

                    // Force Vite scripts for React/Vite (Fixes the MIME type error)
                    if (!scripts.dev) {
                        if (detectedFramework === "next") {
                            scripts.dev = "next dev";
                            scripts.build = "next build";
                            scripts.start = "next start";
                        } else if (
                            detectedFramework === "vite" ||
                            detectedFramework === "react"
                        ) {
                            scripts.dev = "vite --host"; // Simple vite start
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

                // 7. Ensure Vite Config exists for React projects
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

                // 8. Ensure index.html exists
                if (!files["index.html"]) {
                    files["index.html"] = {
                        file: {
                            contents: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
                        },
                    };
                }

                addLog("📁 Mounting files...");
                await webcontainer.mount(files);

                // 9. Install Dependencies (With CI=true fix)
                setStatus("installing");
                addLog("📦 Installing dependencies...");

                const installProcess = await webcontainer.spawn(
                    "npm",
                    [
                        "install",
                        "--no-audit",
                        "--no-fund",
                        "--legacy-peer-deps",
                    ],
                    {
                        env: {
                            CI: "true", // <--- DISALES SPINNER
                            npm_config_loglevel: "warn",
                        },
                    }
                );

                installProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            // Aggressive cleaning to remove spinner artifacts
                            const cleaned = data
                                .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "") // ANSI codes
                                .replace(/[\u2580-\u259F]/g, "") // Block chars
                                .trim();

                            if (
                                cleaned &&
                                !["|", "/", "-", "\\"].includes(cleaned)
                            ) {
                                // console.log("[npm]", cleaned);
                                // Only log warnings/errors to UI to keep it clean
                                if (
                                    cleaned.toLowerCase().includes("warn") ||
                                    cleaned.toLowerCase().includes("err")
                                ) {
                                    addLog(cleaned);
                                }
                            }
                        },
                    })
                );

                if ((await installProcess.exit) !== 0) {
                    throw new Error("Installation failed");
                }

                addLog("✅ Dependencies installed");

                // 10. Start Server
                setStatus("running");
                addLog("🚀 Starting dev server...");

                const devProcess = await webcontainer.spawn("npm", [
                    "run",
                    "dev",
                ]);

                devProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            const cleaned = data
                                .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
                                .trim();
                            if (cleaned) {
                                // console.log("[server]", cleaned);
                                if (
                                    cleaned.includes("ready in") ||
                                    cleaned.includes("Local:")
                                ) {
                                    addLog("⚡ Server Ready!");
                                }
                            }
                        },
                    })
                );

                webcontainer.on("server-ready", (port, url) => {
                    addLog(`✅ Preview ready on ${url}`);
                    setUrl(url);
                    setTimeout(() => setShowCodeEditor(false), 800);
                });
            } catch (err) {
                console.error(err);
                setStatus("error");
                addLog(
                    `❌ Error: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }
        };

        runCode();
    }, [code, webcontainer, status]);
    const handleFileChange = async (path: string, newContent: string) => {
        // 1. Update UI State (so the editor reflects the change immediately)
        setParsedFiles((prev) =>
            prev.map((f) =>
                f.path === path ? { ...f, content: newContent } : f
            )
        );

        // 2. Write to WebContainer (Vite HMR will pick this up automatically)
        if (webcontainer) {
            try {
                await webcontainer.fs.writeFile(path, newContent);
            } catch (err) {
                console.error("Failed to write file:", err);
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

            {/* Terminal */}
            <div className="h-48 border-t border-slate-800 bg-black p-2 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2 px-2">
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
                <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 p-2 space-y-1">
                    {logs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all">
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
