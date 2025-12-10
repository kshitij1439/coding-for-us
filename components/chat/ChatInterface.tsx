"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Terminal, Code2, Cpu, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseMessageContent } from "@/lib/stream-parser";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    isStreaming?: boolean;
}

interface ChatInterfaceProps {
    setGeneratedCode: (code: string) => void;
}

export default function ChatInterface({
    setGeneratedCode,
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ 
            behavior: "smooth",
            block: "nearest",
            inline: "nearest"
        });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isGenerating) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsGenerating(true);

        const assistantMessageId = (Date.now() + 1).toString();
        setMessages((prev) => [
            ...prev,
            {
                id: assistantMessageId,
                role: "assistant",
                content: "",
                isStreaming: true,
            },
        ]);

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: userMessage.content }),
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";
            let codeSentToContainer = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const rawChunk = decoder.decode(value, { stream: true });
                const lines = rawChunk.split("\n").filter(Boolean);

                for (const line of lines) {
                    try {
                        const packet = JSON.parse(line);

                        if (packet.type === "chunk" && packet.content) {
                            fullContent += packet.content;

                            // Parse the accumulated content
                            const parsed = parseMessageContent(fullContent);

                            // Update chat UI with text only (no code block)
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? {
                                              ...msg,
                                              content:
                                                  parsed.textContent ||
                                                  "Generating code...",
                                          }
                                        : msg
                                )
                            );

                            // Send complete code to WebContainer immediately
                            if (
                                parsed.hasCode &&
                                parsed.isComplete &&
                                !codeSentToContainer
                            ) {
                                // console.log('Sending code to WebContainer:', parsed.codeContent);
                                setGeneratedCode(parsed.codeContent);
                                codeSentToContainer = true;
                            }
                        } else if (packet.type === "complete") {
                            // console.log('Generation complete');
                        } else if (packet.type === "error") {
                            throw new Error(packet.message);
                        }
                    } catch (parseError) {
                        console.warn("Failed to parse line:", line, parseError);
                    }
                }
            }

            // Final update - show text description only
            const finalParsed = parseMessageContent(fullContent);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? {
                              ...msg,
                              content:
                                  finalParsed.textContent ||
                                  "Code generated successfully!",
                              isStreaming: false,
                          }
                        : msg
                )
            );

            // Ensure code was sent
            if (
                finalParsed.hasCode &&
                finalParsed.isComplete &&
                !codeSentToContainer
            ) {
                setGeneratedCode(finalParsed.codeContent);
            }
        } catch (error) {
            console.error("Error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: "assistant",
                    content: `❌ Error: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }`,
                },
            ]);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center space-x-2 bg-slate-900/50 backdrop-blur-sm">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-sm font-mono text-slate-400">
                    agent-v1.tsx
                </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                        <Cpu size={48} className="mb-4" />
                        <p className="text-lg">
                            Ready to build. What's on your mind?
                        </p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-start space-x-3 ${
                                msg.role === "user"
                                    ? "flex-row-reverse space-x-reverse"
                                    : ""
                            }`}
                        >
                            <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    msg.role === "user"
                                        ? "bg-blue-600"
                                        : "bg-emerald-600"
                                }`}
                            >
                                {msg.role === "user" ? (
                                    <Terminal size={16} />
                                ) : (
                                    <Code2 size={16} />
                                )}
                            </div>

                            <div
                                className={`p-3 rounded-lg max-w-[85%] text-sm leading-relaxed ${
                                    msg.role === "user"
                                        ? "bg-blue-600/20 text-blue-100 border border-blue-600/30"
                                        : "bg-slate-900 border border-slate-800"
                                }`}
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>

                                {msg.isStreaming &&
                                    msg.role === "assistant" && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.8,
                                            }}
                                            className="inline-block w-2 h-4 ml-1 align-middle bg-emerald-500"
                                        />
                                    )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Build me a..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
                        disabled={isGenerating}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isGenerating}
                        className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
