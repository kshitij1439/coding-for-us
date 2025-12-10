"use client";

import React, { useState, useEffect } from "react";
import { File, Folder, ChevronRight, ChevronDown } from "lucide-react";

type Framework = "react" | "expo" | "next" | "vite";

interface FileItem {
    path: string;
    content: string;
    type?: string;
}

interface CodeEditorProps {
    files: FileItem[];
    isStreaming?: boolean;
    framework?: Framework;
    // New prop for handling edits
    onFileChange?: (path: string, newContent: string) => void;
}

export default function CodeEditor({
    files,
    isStreaming,
    framework,
    onFileChange,
}: CodeEditorProps) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
        new Set()
    );

    useEffect(() => {
        const allFolders = new Set<string>();

        files.forEach((file) => {
            const parts = file.path.split("/");
            let currentPath = "";

            for (let i = 0; i < parts.length - 1; i++) {
                currentPath = currentPath
                    ? `${currentPath}/${parts[i]}`
                    : parts[i];
                allFolders.add(currentPath);
            }
        });

        setExpandedFolders(allFolders);
    }, [files]);
    // Auto-select first file
    useEffect(() => {
        if (files.length > 0 && !selectedFile) {
            setSelectedFile(files[0].path);
        }
    }, [files, selectedFile]);

    // --- Tree Logic (Unchanged) ---
    const buildFileTree = () => {
        const tree: any = {};
        files.forEach((file) => {
            const parts = file.path.split("/");
            let current = tree;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = { ...file, isFile: true };
                } else {
                    if (!current[part])
                        current[part] = { isFolder: true, children: {} };
                    current = current[part].children;
                }
            });
        });
        return tree;
    };

    const toggleFolder = (path: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.has(path) ? next.delete(path) : next.add(path);
            return next;
        });
    };

    const renderTree = (node: any, path = "", level = 0) => {
        return Object.entries(node).map(([name, item]: [string, any]) => {
            const fullPath = path ? `${path}/${name}` : name;
            if (item.isFile) {
                return (
                    <div
                        key={fullPath}
                        onClick={() => setSelectedFile(fullPath)}
                        className={`flex items-center space-x-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded text-xs ${
                            selectedFile === fullPath
                                ? "bg-slate-800 text-blue-400"
                                : "text-slate-300"
                        }`}
                        style={{ paddingLeft: `${level * 12 + 8}px` }}
                    >
                        <File size={14} />
                        <span className="font-mono">{name}</span>
                        {isStreaming && (
                            <span className="ml-auto text-emerald-500 animate-pulse">
                                ●
                            </span>
                        )}
                    </div>
                );
            }
            if (item.isFolder) {
                const isExpanded = expandedFolders.has(fullPath);
                return (
                    <div key={fullPath}>
                        <div
                            onClick={() => toggleFolder(fullPath)}
                            className="flex items-center space-x-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded text-xs text-slate-300"
                            style={{ paddingLeft: `${level * 12 + 8}px` }}
                        >
                            {isExpanded ? (
                                <ChevronDown size={14} />
                            ) : (
                                <ChevronRight size={14} />
                            )}
                            <Folder size={14} />
                            <span className="font-mono">{name}</span>
                        </div>
                        {isExpanded && (
                            <div>
                                {renderTree(item.children, fullPath, level + 1)}
                            </div>
                        )}
                    </div>
                );
            }
            return null;
        });
    };

    const selectedFileContent = files.find((f) => f.path === selectedFile);
    const fileTree = buildFileTree();

    return (
        <div className="flex h-full bg-slate-950 border-l border-slate-800">
            {/* Sidebar */}
            <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                <div className="p-3 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Files{" "}
                    {isStreaming && (
                        <span className="text-emerald-500 animate-pulse">
                            ● Streaming
                        </span>
                    )}
                    {framework && (
                        <span className="ml-2 text-[10px] bg-slate-800 px-1 rounded">
                            {framework}
                        </span>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {files.length === 0 ? (
                        <div className="text-slate-500 text-xs p-4 text-center">
                            Waiting for files...
                        </div>
                    ) : (
                        renderTree(fileTree)
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col relative">
                {selectedFile && selectedFileContent ? (
                    <>
                        <div className="h-10 border-b border-slate-800 flex items-center px-4 bg-slate-900/30 shrink-0">
                            <File size={14} className="text-slate-400 mr-2" />
                            <span className="text-xs font-mono text-slate-300">
                                {selectedFile}
                            </span>
                            <span className="ml-auto text-[10px] text-slate-500">
                                Live Edit
                            </span>
                        </div>

                        <div className="flex-1 relative bg-slate-950">
                            <textarea
                                value={selectedFileContent.content}
                                onChange={(e) => {
                                    if (onFileChange) {
                                        onFileChange(
                                            selectedFile,
                                            e.target.value
                                        );
                                    }
                                }}
                                spellCheck={false}
                                className="absolute inset-0 w-full h-full p-4 bg-transparent text-slate-300 font-mono text-xs resize-none outline-none border-none leading-relaxed"
                                style={{
                                    tabSize: 2,
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        <div className="text-center">
                            <File
                                size={48}
                                className="mx-auto mb-4 opacity-50"
                            />
                            <p>Select a file to edit</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
