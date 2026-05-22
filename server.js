import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { streamSSE } from 'hono/streaming';

const app = new Hono();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'anthropic/claude-sonnet-4.5';
const LOGO_MODEL = 'google/gemini-2.0-flash-001';
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
      temperature: model === LOGO_MODEL ? 0.7 : 1,
      max_tokens: model === LOGO_MODEL ? 8192 : 4096,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  return res;
}

function extractJSON(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  throw new Error('No JSON array found in response');
}

// Parse logo SVGs from delimited response
function parseLogos(text, count) {
  const logos = [];
  for (let i = 0; i < count; i++) {
    const startTag = `<logo id="${i}">`;
    const endTag = `</logo>`;
    const startIdx = text.indexOf(startTag);
    const endIdx = text.indexOf(endTag, startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
      const svg = text.slice(startIdx + startTag.length, endIdx).trim();
      logos.push(svg);
    } else {
      logos.push(null);
    }
  }
  return logos;
}

// Domain accent colors
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

      // Send domains immediately
      await stream.writeSSE({ data: JSON.stringify({ type: 'domains', domains }), event: 'message' });

      // Fire domain logo generation in parallel (don't await yet)
      const domainLogoPromise = (async () => {
        try {
          const items = domains.map((d, i) => `${i}: "${d.domain}" — accent color: ${DOMAIN_COLORS[i % DOMAIN_COLORS.length]}`).join('\n');
          const logoPrompt = `You are an elite logo designer. Generate minimalist, futuristic SVG logos for tech companies.

ABSOLUTE RULES:
- ViewBox: exactly "0 0 64 64"
- Background: transparent (NO background rect)
- Style: geometric, abstract, minimal — think Stripe, Linear, Notion, Abstract quality
- ONE accent color per logo (given below) + white/gray elements
- NO text, NO letters, NO words — pure abstract symbol/mark
- Clean vector paths, smooth curves, sharp geometry
- Professional enough for a Series A pitch deck
- Each logo must be visually DISTINCT from the others

Generate a logo for each item below. Wrap each in <logo id="N"> tags.

Items:
${items}

Return format:
<logo id="0"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">...</svg></logo>
<logo id="1">...</logo>
...`;
          const res = await llmCall([{ role: 'user', content: logoPrompt }], { model: LOGO_MODEL });
          const data = await res.json();
          return parseLogos(data.choices[0].message.content, domains.length);
        } catch (e) {
          console.error('Domain logo gen failed:', e.message);
          return domains.map(() => null);
        }
      })();

      // Phase 2: Collide each domain (in parallel with logo gen)
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

        // Generate logos for these ideas (in background)
        const ideaLogoPromise = (async () => {
          try {
            const items = ideas.map((idea, j) => `${j}: "${idea.company_name}" (inspired by ${d.domain}) — accent: ${accentColor}`).join('\n');
            const logoPrompt = `You are an elite logo designer. Generate minimalist, futuristic SVG logos.

ABSOLUTE RULES:
- ViewBox: exactly "0 0 64 64"
- Background: transparent (NO background rect)
- Style: geometric, abstract, minimal — Series A pitch deck quality
- ONE accent color per logo (given below) + white/gray tones allowed
- NO text, NO letters, NO words — pure abstract symbol/mark
- Each logo should subtly evoke the domain it came from, but look like a tech company mark
- Clean vector paths, professional, distinctive

Items:
${items}

Return format:
<logo id="0"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">...</svg></logo>
<logo id="1">...</logo>`;
            const res = await llmCall([{ role: 'user', content: logoPrompt }], { model: LOGO_MODEL });
            const data = await res.json();
            return parseLogos(data.choices[0].message.content, ideas.length);
          } catch (e) {
            console.error('Idea logo gen failed:', e.message);
            return ideas.map(() => null);
          }
        })();

        // Send collision data immediately
        await stream.writeSSE({
          data: JSON.stringify({ type: 'collision', domainIndex: i, domain: d.domain, ideas, accentColor }),
          event: 'message',
        });

        // Send idea logos when ready (don't block next collision)
        ideaLogoPromise.then(async (logos) => {
          try {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'idea-logos', domainIndex: i, logos }),
              event: 'message',
            });
          } catch (e) { /* stream may have closed */ }
        });
      }

      // Wait for domain logos and send them
      const domainLogos = await domainLogoPromise;
      await stream.writeSSE({
        data: JSON.stringify({ type: 'domain-logos', logos: domainLogos }),
        event: 'message',
      });

      // Wait a beat for any remaining idea logos to flush
      await new Promise(r => setTimeout(r, 3000));

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
  console.log(`Open Collider POC running on http://localhost:${port}`);
});
