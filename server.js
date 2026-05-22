import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { streamSSE } from 'hono/streaming';

const app = new Hono();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'anthropic/claude-sonnet-4.5';
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function llmCall(messages, { stream = false, model = MODEL } = {}) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://open-collider-poc.fly.dev',
      'X-Title': 'Open Collider POC',
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      temperature: 1,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  return res;
}

// Generate an image via OpenAI gpt-image-1
async function generateImage(prompt) {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'low',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`OpenAI image error ${res.status}: ${text}`);
      return null;
    }
    const data = await res.json();
    // gpt-image-1 returns b64_json by default
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    // fallback to URL if present
    const url = data.data?.[0]?.url;
    return url || null;
  } catch (e) {
    console.error('Image gen failed:', e.message);
    return null;
  }
}

function extractJSON(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  throw new Error('No JSON array found in response');
}

const DOMAIN_COLORS = ['#00CC66', '#FF4F00', '#0088FF', '#AA44FF'];

app.post('/api/collide', async (c) => {
  const { brief } = await c.req.json();
  if (!brief || !brief.trim()) return c.json({ error: 'Brief is required' }, 400);

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({ data: JSON.stringify({ type: 'status', message: 'Generating distant domains...' }), event: 'message' });

      const domainPrompt = `You are a bisociation engine. Given an ideation brief, generate 4 structurally distant knowledge domains that have NOTHING obvious to do with the brief's field. Each domain must include:
1. Domain name (e.g. "fungal mycelium networks", "Ottoman tax farming", "semiconductor doping")
2. An active principle — a specific counter-intuitive mechanism from that domain
3. A bridging question — how might this principle apply to the brief?

Rules:
- Domains must be from DIFFERENT fields (biology, physics, history, economics, manufacturing, etc.)
- The more counter-intuitive the connection, the better
- Avoid cliché metaphors (no "ecosystem", no "DNA of the company")
- Each active principle must be a real, specific mechanism — not a vague analogy

Brief: ${brief}

Return ONLY a JSON array: [{"domain": "...", "active_principle": "...", "bridging_question": "..."}]`;

      const domainRes = await llmCall([{ role: 'user', content: domainPrompt }]);
      const domainData = await domainRes.json();
      const domainText = domainData.choices[0].message.content;
      const domains = extractJSON(domainText);

      await stream.writeSSE({ data: JSON.stringify({ type: 'domains', domains }), event: 'message' });

      // Generate domain logos in parallel via gpt-image-1
      const domainLogoPromises = domains.map((d, i) => {
        const color = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
        return generateImage(
          `Minimalist, futuristic tech company logo mark for "${d.domain}". Abstract geometric symbol, single accent color ${color} on pure white background. No text, no letters, no words. Clean vector style like Stripe/Linear/Notion branding. Professional Series A quality. Simple, bold, iconic.`
        );
      });

      // Phase 2: Collide each domain
      const ideaLogoFlushers = [];
      for (let i = 0; i < domains.length; i++) {
        const d = domains[i];
        const accentColor = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
        await stream.writeSSE({ data: JSON.stringify({ type: 'status', message: `Colliding: ${d.domain}...` }), event: 'message' });

        const collisionPrompt = `You are generating startup ideas through bisociation — colliding a distant domain with a problem brief.

Brief: ${brief}
Distant Domain: ${d.domain}
Active Principle: ${d.active_principle}
Bridging Question: ${d.bridging_question}

Generate 2 non-trivial startup ideas that could ONLY exist because of this collision. Each idea must have:
1. "company_name" — a short, punchy, brandable startup name (1-2 words, like "Stripe", "Notion", "Vercel", "Runway"). Must sound like a real tech company.
2. "tagline" — a 3-8 word product tagline
3. "mechanism" — how the active principle transfers (1-2 sentences, concrete, not metaphorical)
4. "attribution" — "↳ from ${d.domain}"

Return ONLY a JSON array: [{"company_name": "...", "tagline": "...", "mechanism": "...", "attribution": "..."}]`;

        const collisionRes = await llmCall([{ role: 'user', content: collisionPrompt }]);
        const collisionData = await collisionRes.json();
        const collisionText = collisionData.choices[0].message.content;
        const ideas = extractJSON(collisionText);

        await stream.writeSSE({
          data: JSON.stringify({ type: 'collision', domainIndex: i, domain: d.domain, ideas, accentColor }),
          event: 'message',
        });

        // Generate idea logos in background
        const ideaLogoPromises = ideas.map((idea) =>
          generateImage(
            `Minimalist, futuristic tech startup logo for "${idea.company_name}" (inspired by ${d.domain}). Abstract geometric symbol, accent color ${accentColor} on pure white background. No text, no letters, no words. Clean vector style, professional branding. Simple, bold, iconic mark.`
          )
        );

        const flusher = Promise.all(ideaLogoPromises).then(async (logos) => {
          try {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'idea-logos', domainIndex: i, logos }),
              event: 'message',
            });
          } catch (e) { /* stream may have closed */ }
        });
        ideaLogoFlushers.push(flusher);
      }

      // Wait for domain logos and send them
      const domainLogos = await Promise.all(domainLogoPromises);
      await stream.writeSSE({
        data: JSON.stringify({ type: 'domain-logos', logos: domainLogos }),
        event: 'message',
      });

      // Wait for all idea logos to flush
      await Promise.allSettled(ideaLogoFlushers);

      await stream.writeSSE({ data: JSON.stringify({ type: 'done' }), event: 'message' });
    } catch (err) {
      console.error('Collide error:', err);
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err.message }), event: 'message' });
    }
  });
});

app.post('/api/regen-examples', async (c) => {
  try {
    const { motif } = await c.req.json().catch(() => ({}));
    const motifClause = motif
      ? `\n\nMOTIF: "${motif}". All 20 briefs must be ABOUT "${motif}" — different angles, industries, scales. Still 3-8 words each. Still punchy word-cloud tags, not sentences.`
      : '';
    const res = await llmCall([{
      role: 'user',
      content: `Generate 20 provocative ideation briefs for a bisociation engine.

CRITICAL FORMAT RULE: Each brief must be 3-8 words. Like a word cloud tag. NOT a sentence. NOT a description. Just a punchy phrase.

Good examples: "shark-proof swimming pools", "edible architecture", "gym membership guilt", "dating app for enemies", "voting with your feet literally"
Bad examples: "Design a system where sharks patrol swimming pools to keep people honest" (TOO LONG)

Rules:
- Wildly different domains: tech, health, food, finance, culture, science, art, sports, cities, etc.
- Punchy, specific, surprising
- Mix of contrarian, playful, and provocative
- 3-8 words max each. Shorter is better.${motifClause}

Return ONLY a JSON array of 20 strings.`
    }], { stream: false });
    const data = await res.json();
    const text = data.choices[0].message.content;
    const briefs = extractJSON(text);
    return c.json({ briefs });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.use('/*', serveStatic({ root: './public' }));

const port = 8080;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Open Collider running on http://localhost:${port}`);
});
