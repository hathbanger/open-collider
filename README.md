# OPEN COLLIDER

> **Bisociation engine.** Smash distant domains together. See what survives.

[![Live](https://img.shields.io/badge/LIVE-open--collider--poc.fly.dev-FF4F00?style=flat-square)](https://open-collider-poc.fly.dev/)

---

## What is this

Arthur Koestler called it **bisociation** — the creative act of connecting two habitually incompatible frames of reference. Every breakthrough lives at the collision point of things that shouldn't touch.

Open Collider automates this.

You give it a brief. A problem. A domain. A vibe. It finds **four maximally distant domains**, smashes them into your brief, and extracts the ideas that survive the collision.

```
INPUT:  "unused gym memberships"
     ↓
     ↓  collide against: evolutionary biology,
     ↓  street art economics, MMO raid design,
     ↓  sleep architecture
     ↓
OUTPUT: 12 ideas you'd never reach by thinking harder
```

## How it works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   BRIEF     │────▶│  DOMAIN ENGINE   │────▶│  COLLISION   │
│             │     │                  │     │   REACTOR    │
│ your problem│     │ finds 4 distant  │     │             │
│ your domain │     │ domains with     │     │ smashes each │
│ your chaos  │     │ active principles│     │ domain into  │
│             │     │ & bridging Qs    │     │ your brief   │
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                    │
                                              ┌─────▼──────┐
                                              │   IDEAS     │
                                              │             │
                                              │ name        │
                                              │ mechanism   │
                                              │ attribution │
                                              │ ❤️ 👍 🗑️     │
                                              └─────────────┘
```

**Two-phase SSE pipeline:**

1. **Domain generation** — LLM finds 4 domains that are structurally distant but share a deep principle with your brief
2. **Collision** — each domain is collided against your brief, producing concrete ideas with mechanisms and attributions

Domains arrive as empty shells. Ideas fill them in real-time. You rate what hits.

## Motif

Type a **motif** and hit regen. The engine generates 20 briefs *about* that topic — every angle, every framing. Type "sharks" and get 20 shark problems to collide.

The motif shapes the lens. The collisions do the rest.

## Stack

- **Runtime:** Node.js + [Hono](https://hono.dev)
- **Frontend:** Vanilla HTML/CSS/JS. No framework. No build step.
- **LLM:** Claude Sonnet 4.5 via [OpenRouter](https://openrouter.ai)
- **Deploy:** [Fly.io](https://fly.io)
- **Aesthetic:** Terminal dark. `#0A0A0A` background. JetBrains Mono. Orange `#FF4F00` + green `#00CC66`.

## Run it

```bash
git clone https://github.com/hathbanger/open-collider.git
cd open-collider
npm install

# Set your OpenRouter API key
export OPENROUTER_API_KEY=sk-or-v1-...

npm start
# → http://localhost:3001
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | yes | OpenRouter API key |
| `PORT` | no | Server port (default: 3001) |

## Mobile

Full mobile-first responsive. On phone: briefs take the full screen, tap to collide, results go fullscreen with a `← BRIEFS` back button. On desktop: 25/75 sidebar split with auto-fitted brief font sizes.

## The theory

> "The creative act is not an act of creation in the sense of the Old Testament. It does not create something out of nothing; it uncovers, selects, re-shuffles, combines, synthesizes already existing facts, ideas, faculties, skills."
>
> — Arthur Koestler, *The Act of Creation* (1964)

Most ideation tools help you think *harder* about what you already know. Open Collider forces you to think *differently* by importing structure from domains you'd never visit.

The best ideas aren't at the center of your expertise. They're at the **collision boundary** of two fields that have never met.

## License

MIT

---

*Built in one session by a human and an AI at 4am. The ideas are real. Ship them.*
