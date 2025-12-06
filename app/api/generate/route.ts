import { NextRequest } from 'next/server'
import { streamCodeGeneration, parseTOONResponse, toonToFiles } from '@/lib/ai/gemini'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { prompt, fileContext } = await req.json()

    const encoder = new TextEncoder()
    let accumulatedResponse = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream tokens from Gemini
          for await (const chunk of streamCodeGeneration(prompt, fileContext)) {
            accumulatedResponse += chunk
            
            // Send raw chunks for real-time display
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'chunk', 
              content: chunk 
            }) + '\n'))
          }

          // Parse complete response
          const toonData = parseTOONResponse(accumulatedResponse)
          
          if (toonData) {
            const files = toonToFiles(toonData)
            
            // Send parsed files
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'complete',
              files,
              meta: toonData.meta
            }) + '\n'))
          } else {
            // Fallback: send raw response if TOON parsing fails
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'complete',
              content: accumulatedResponse
            }) + '\n'))
          }

          controller.close()
        } catch (error) {
          console.error('Generation error:', error)
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          }) + '\n'))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson', // Newline-delimited JSON
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: 'Error generating code' }), 
      { status: 500 }
    )
  }
}