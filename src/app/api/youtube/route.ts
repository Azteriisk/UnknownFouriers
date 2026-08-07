// src/app/api/youtube/route.ts - Proxy & Stream extractor for YouTube Audio

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Please provide a valid YouTube URL.' }, { status: 400 });
    }

    // Extract video ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube Video ID. Please check the URL.' }, { status: 400 });
    }

    // Attempt audio stream extraction via Cobalt / Piped public instance API
    const instances = [
      'https://api.cobalt.tools/api/json',
      'https://pipedapi.kavin.rocks/streams/' + videoId,
    ];

    let audioUrl: string | null = null;

    // Try Cobalt API
    try {
      const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
        }),
      });

      if (cobaltRes.ok) {
        const cobaltData = await cobaltRes.json();
        if (cobaltData.url) {
          audioUrl = cobaltData.url;
        }
      }
    } catch {
      // Fallback to Piped API
    }

    if (!audioUrl) {
      try {
        const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
        if (pipedRes.ok) {
          const pipedData = await pipedRes.json();
          const audioStreams = pipedData.audioStreams;
          if (audioStreams && audioStreams.length > 0) {
            audioUrl = audioStreams[0].url;
          }
        }
      } catch {
        // Piped fallback failed
      }
    }

    if (audioUrl) {
      return NextResponse.json({ success: true, videoId, audioUrl });
    } else {
      return NextResponse.json(
        {
          error:
            'YouTube audio extraction is temporarily blocked by YouTube rate-limits. Try using File Upload, Live Mic, or Demo Presets!',
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
