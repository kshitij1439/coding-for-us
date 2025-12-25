"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface XTerminalRef {
    terminal: Terminal | null;
    fitAddon: FitAddon | null;
}

interface XTerminalProps {
    webcontainer?: any;
}

const XTerminal = forwardRef<XTerminalRef, XTerminalProps>(
    ({ webcontainer }, ref) => {
        const terminalRef = useRef<HTMLDivElement>(null);
        const xtermRef = useRef<Terminal | null>(null);
        const fitAddonRef = useRef<FitAddon | null>(null);
        const shellProcessRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            terminal: xtermRef.current,
            fitAddon: fitAddonRef.current,
        }));

        // Initialize Terminal
        useEffect(() => {
            if (!terminalRef.current || xtermRef.current) return;

            const term = new Terminal({
                cursorBlink: true,
                fontSize: 12,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: {
                    background: "#000000",
                    foreground: "#cbd5e1",
                    cursor: "#cbd5e1",
                    black: "#1e293b",
                    red: "#ef4444",
                    green: "#10b981",
                    yellow: "#f59e0b",
                    blue: "#3b82f6",
                    magenta: "#a855f7",
                    cyan: "#06b6d4",
                    white: "#cbd5e1",
                },
                allowProposedApi: true,
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);
            fitAddon.fit();

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            const resizeObserver = new ResizeObserver(() => {
                fitAddon.fit();
            });
            resizeObserver.observe(terminalRef.current);

            return () => {
                resizeObserver.disconnect();
                term.dispose();
                xtermRef.current = null;
            };
        }, []);

        useEffect(() => {
            if (!webcontainer || !xtermRef.current || shellProcessRef.current)
                return;

            const startShell = async () => {
                const term = xtermRef.current!;

                term.writeln("\x1b[1;32m✓\x1b[0m WebContainer Ready");
                term.writeln("");

                try {
                    const shellProcess = await webcontainer.spawn("jsh", {
                        terminal: {
                            cols: term.cols,
                            rows: term.rows,
                        },
                    });

                    shellProcessRef.current = shellProcess;

                    // Pipe shell output to terminal
                    shellProcess.output.pipeTo(
                        new WritableStream({
                            write(data) {
                                term.write(data);
                            },
                        })
                    );

                    // Pipe terminal input to shell
                    const input = shellProcess.input.getWriter();
                    term.onData((data) => {
                        input.write(data);
                    });

                    // Handle terminal resize
                    term.onResize(({ cols, rows }) => {
                        shellProcess.resize({ cols, rows });
                    });
                } catch (err) {
                    term.writeln(
                        `\x1b[1;31m✗\x1b[0m Failed to start shell: ${err}`
                    );
                }
            };

            startShell();

            return () => {
                if (shellProcessRef.current) {
                    shellProcessRef.current.kill();
                    shellProcessRef.current = null;
                }
            };
        }, [webcontainer]);

        return <div ref={terminalRef} className="flex-1 overflow-hidden" />;
    }
);

XTerminal.displayName = "XTerminal";

export default XTerminal;
