"use client";
import { useEffect, useState } from "react";
import PreviewPane from "@/components/chat/PreviewPlane";
import ChatInterface from "@/components/chat/ChatInterface";
import { WebContainerProvider } from "@/lib/webcontainer";
import { ArrowLeft } from "lucide-react";

export default function Home() {
    const [generatedCode, setGeneratedCode] = useState("");
    const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");

    return (
        <WebContainerProvider>
            <main className="flex h-screen bg-black text-white overflow-hidden">

                <div className="hidden md:flex w-full h-full">

                    <div className="w-[400px] lg:w-[450px] shrink-0 h-full border-r border-slate-800">
                        <ChatInterface setGeneratedCode={setGeneratedCode} />
                    </div>
                    <div className="flex-1 h-full bg-slate-900 relative">
                        <PreviewPane code={generatedCode} />
                    </div>
                </div>

                <div className="md:hidden flex flex-col w-full h-full">

                    {mobileView === "chat" ? (
                        <ChatInterface
                            setGeneratedCode={setGeneratedCode}
                            onPreviewClick={() => setMobileView("preview")}
                            hasGeneratedCode={!!generatedCode}
                        />
                    ) : (
                        <>
                            <div className="h-12 border-b border-slate-800 flex items-center px-4 bg-slate-900/50">
                                <button
                                    onClick={() => setMobileView("chat")}
                                    className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
                                >
                                    <ArrowLeft size={20} />
                                    <span className="text-sm">
                                        Back to Chat
                                    </span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <PreviewPane code={generatedCode} />
                            </div>
                        </>
                    )}
                </div>
            </main>
        </WebContainerProvider>
    );
}
