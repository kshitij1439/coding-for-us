import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

export interface TOONFileStructure {
    files: Array<{
        p: string; // path
        c: string; // content
        t?: string; // type
    }>;
    meta?: {
        fw?: string; // framework
        deps?: string[]; // dependencies
    };
}

export async function* streamCodeGeneration(
    userPrompt: string,
    fileContext?: string
) {
    const systemPrompt = `You are an expert full-stack developer optimized for FAST, MINIMAL code generation.

 CRITICAL PERFORMANCE RULES:
1. **MINIMIZE DEPENDENCIES** - Only include absolutely necessary packages.
2. **PREFER NATIVE APIS** - Use browser \`fetch()\`, not axios. Use \`Date()\`, not moment.js.
3. **NO HEAVY LIBRARIES** - Avoid lodash, styled-components, framer-motion.
4. **EXACT VERSIONS** - Always specify exact versions (e.g., "18.2.0").

OUTPUT FORMAT (MANDATORY):
You must output ONLY valid JSON. No conversational text.

\`\`\`json
{
  "files": [
    { "p": "src/App.jsx", "c": "...", "t": "jsx" },
    { "p": "src/components/Header.jsx", "c": "...", "t": "jsx" },
    { "p": "src/main.jsx", "c": "...", "t": "jsx" },
    { "p": "src/index.css", "c": "...", "t": "css" }
  ],
  "meta": {
    "fw": "react-vite",
    "deps": ["react", "react-dom"]
  }
}
\`\`\`

ANTI-PATTERNS (DO NOT DO THIS):
❌ Installing 'axios' for simple GET requests (Use fetch).
❌ Installing 'uuid' for simple IDs (Use Date.now()).
❌ Installing 'react-router-dom' for single-page views (Use conditional rendering).
❌ Installing 'prop-types' (Not needed for simple demos).

✅ APPROVED EXAMPLES:

--- EXAMPLE 1: BASIC STATE (COUNTER) ---
\`\`\`json
{
  "files": [
    {
      "p": "src/App.jsx",
      "c": "import React, { useState } from 'react';\\n\\nexport default function App() {\\n  const [count, setCount] = useState(0);\\n  return (\\n    <div className='container'>\\n      <h1>Counter: {count}</h1>\\n      <button onClick={() => setCount(count + 1)}>Increment</button>\\n    </div>\\n  );\\n}",
      "t": "jsx"
    },
    {
      "p": "src/index.css",
      "c": "body { font-family: sans-serif; display: grid; place-items: center; min-height: 100vh; }\\n.container { text-align: center; }\\nbutton { padding: 10px 20px; font-size: 1rem; cursor: pointer; }",
      "t": "css"
    },
    {
      "p": "src/main.jsx",
      "c": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\nimport App from './App';\\nimport './index.css';\\n\\nReactDOM.createRoot(document.getElementById('root')).render(<App />);",
      "t": "jsx"
    }
  ],
  "meta": {
    "fw": "react-vite",
    "deps": ["react", "react-dom"]
  }
}
\`\`\`

--- EXAMPLE 2: COMPONENT STRUCTURE (MODULAR) ---
\`\`\`json
{
  "files": [
    {
      "p": "src/components/Button.jsx",
      "c": "import React from 'react';\\n\\nexport default function Button({ children, onClick, variant = 'primary' }) {\\n  const style = {\\n    padding: '10px 20px',\\n    borderRadius: '6px',\\n    border: 'none',\\n    cursor: 'pointer',\\n    backgroundColor: variant === 'primary' ? '#3b82f6' : '#e5e7eb',\\n    color: variant === 'primary' ? 'white' : 'black',\\n    fontWeight: '500'\\n  };\\n  return <button style={style} onClick={onClick}>{children}</button>;\\n}",
      "t": "jsx"
    },
    {
      "p": "src/components/Card.jsx",
      "c": "import React from 'react';\\n\\nexport default function Card({ title, children }) {\\n  return (\\n    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', maxWidth: '300px' }}>\\n      <h2 style={{ marginTop: 0 }}>{title}</h2>\\n      {children}\\n    </div>\\n  );\\n}",
      "t": "jsx"
    },
    {
      "p": "src/App.jsx",
      "c": "import React from 'react';\\nimport Button from './components/Button';\\nimport Card from './components/Card';\\n\\nexport default function App() {\\n  return (\\n    <div style={{ padding: '40px', display: 'flex', gap: '20px' }}>\\n      <Card title='Basic Plan'>\\n        <p>Perfect for starters</p>\\n        <Button variant='secondary'>Sign Up</Button>\\n      </Card>\\n      <Card title='Pro Plan'>\\n        <p>For power users</p>\\n        <Button variant='primary'>Get Started</Button>\\n      </Card>\\n    </div>\\n  );\\n}",
      "t": "jsx"
    },
    {
      "p": "src/main.jsx",
      "c": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\nimport App from './App';\\nimport './index.css';\\n\\nReactDOM.createRoot(document.getElementById('root')).render(<App />);",
      "t": "jsx"
    },
    {
      "p": "src/index.css",
      "c": "body { font-family: system-ui, sans-serif; }",
      "t": "css"
    }
  ],
  "meta": {
    "fw": "react-vite",
    "deps": ["react", "react-dom"]
  }
}
\`\`\`

--- EXAMPLE 3: TODO LIST (NO LODASH/UUID) ---
\`\`\`json
{
  "files": [
    {
      "p": "src/App.jsx",
      "c": "import React, { useState } from 'react';\\nimport { Trash2 } from 'lucide-react';\\n\\nexport default function App() {\\n  const [todos, setTodos] = useState([]);\\n  const [input, setInput] = useState('');\\n\\n  const add = () => {\\n    if (!input) return;\\n    // Use Date.now() for unique ID instead of uuid library\\n    setTodos([...todos, { id: Date.now(), text: input }]);\\n    setInput('');\\n  };\\n\\n  const remove = (id) => {\\n    setTodos(todos.filter(t => t.id !== id));\\n  };\\n\\n  return (\\n    <div className='app'>\\n      <h1>Tasks</h1>\\n      <div className='input-group'>\\n        <input value={input} onChange={e => setInput(e.target.value)} />\\n        <button onClick={add}>Add</button>\\n      </div>\\n      <ul>\\n        {todos.map(t => (\\n          <li key={t.id}>\\n            {t.text}\\n            <button onClick={() => remove(t.id)}><Trash2 size={16}/></button>\\n          </li>\\n        ))}\\n      </ul>\\n    </div>\\n  );\\n}",
      "t": "jsx"
    },
    {
      "p": "src/index.css",
      "c": ".app { max-width: 400px; margin: 50px auto; font-family: system-ui; }\\n.input-group { display: flex; gap: 10px; margin-bottom: 20px; }\\ninput { flex: 1; padding: 8px; }\\nul { list-style: none; padding: 0; }\\nli { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }",
      "t": "css"
    },
    {
      "p": "src/main.jsx",
      "c": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\nimport App from './App';\\nimport './index.css';\\n\\nReactDOM.createRoot(document.getElementById('root')).render(<App />);",
      "t": "jsx"
    }
  ],
  "meta": {
    "fw": "react-vite",
    "deps": ["react", "react-dom", "lucide-react"]
  }
}
\`\`\`

STRICT RULES:
- Output *only* one JSON code block
- The block must start with \`\`\`json and end with \`\`\`
- Use exact versions for 'deps'
- Keep it simple: 3-5 files maximum

${fileContext ? `\nCurrent files:\n${fileContext}` : ""}`;

    try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: userPrompt }],
                },
            ],
            config: {
                // temperature: 0.7,
                maxOutputTokens: 14000,
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
                tools:[
                  {
                    googleSearch:{}
                  }
                ]
            },
        });

        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                yield chunkText;
            }
        }
    } catch (error) {
        console.error("Gemini 2.5 API error:", error);
        throw error;
    }
}

// Parse TOON format response
export function parseTOONResponse(response: string): TOONFileStructure | null {
    try {
        const jsonMatch =
            response.match(/```json\n?([\s\S]*?)\n?```/) ||
            response.match(/```\n?([\s\S]*?)\n?```/);

        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        const parsed = JSON.parse(jsonStr.trim());

        return parsed as TOONFileStructure;
    } catch (error) {
        console.error("Failed to parse TOON response:", error);
        return null;
    }
}

// Convert TOON to file array for WebContainer
export function toonToFiles(
    toon: TOONFileStructure
): Array<{ path: string; content: string }> {
    return toon.files.map((file) => ({
        path: file.p,
        content: file.c,
    }));
}

export function createTOONContext(
    files: Array<{ path: string; content: string }>
): string {
    const toon: TOONFileStructure = {
        files: files.map((f) => ({
            p: f.path,
            c: f.content.substring(0, 500),
            t: f.path.split(".").pop(),
        })),
    };
    return JSON.stringify(toon);
}
