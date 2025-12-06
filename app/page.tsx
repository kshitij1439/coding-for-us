"use client";

import { useEffect, useState } from "react";
import PreviewPane from "@/components/chat/PreviewPlane";
import ChatInterface from "@/components/chat/ChatInterface";
import { WebContainerProvider } from "@/lib/webcontainer";

export default function Home() {
    const [generatedCode, setGeneratedCode] = useState("");
    // useEffect(() => {
    //     console.log(
    //         "generatedCode changed:",
    //         generatedCode ? generatedCode.substring(0, 100) : "empty"
    //     );
    // }, [generatedCode]);
    return (
        <WebContainerProvider>
            <main className="flex h-screen bg-black text-white overflow-hidden">
                {/* LEFT PANE */}
                <div className="w-full md:w-[400px] lg:w-[450px] shrink-0 h-full border-r border-slate-800">
                    <ChatInterface setGeneratedCode={setGeneratedCode} />
                </div>

                {/* RIGHT PANE */}
                <div className="flex-1 h-full bg-slate-900 relative hidden md:block">
                    <PreviewPane code={generatedCode} />
                </div>
            </main>
        </WebContainerProvider>
    );
}
