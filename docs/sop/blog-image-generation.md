# SOP — Blog Post Image Generation (Gemini Nano Banana)

**Purpose:** A repeatable, manual workflow for turning an approved blog post into a complete, visually-cohesive set of images: hero, Facebook/Open Graph card, Pinterest pin, in-body images, and pull-quote graphics. Designed to be run today, by hand, before the platform automates it.

**Audience:** Freddy (or any future KangoMedia team member). Assumes the writer has access to **Gemini** (gemini.google.com) or **AI Studio** (aistudio.google.com) with the **2.5 Flash Image** model ("Nano Banana") available, and **Claude** (either in this platform or claude.ai).

**Outcome of running this SOP once per post:** a ready-to-publish set of 8–11 images, all visually consistent, with alt text and filenames written, ready to upload to WordPress.

**Time:** 30–45 minutes for a full set, after some practice.

---

## What you'll produce

| Asset | Dimensions | Purpose | Count |
|---|---|---|---|
| Hero / featured image | 1600×900 | Blog header, top of post | 1 |
| Open Graph card | 1200×630 | Facebook, LinkedIn, X/Twitter share preview | 1 |
| Pinterest pin | 1000×1500 | Pinterest distribution | 1 |
| Inline body images | 1200×675 | Break up long sections, illustrate concepts | 3–5 |
| Pull-quote graphics | 1080×1080 | Embedded in post, also Instagram-ready | 1–3 |

**Total:** ~8–11 images per post.

---

## What makes this workflow hold together

**One visual brief, generated up front by Claude, drives every prompt.** Without this, each image is prompted in isolation and the set ends up looking like five different posts. With it, every image references the same palette, mood, and style descriptors.

**The hero image becomes the style reference for everything else.** Nano Banana accepts a reference image in subsequent prompts and preserves the visual treatment. So you generate the hero first, then every other asset is "this new subject, in the style of the hero."

If you skip either of these, the images will look AI-generated and incoherent. Don't skip.

---

## Pre-flight checklist

- [ ] Blog post is **approved by the client** (status APPROVED in the platform — don't generate images for drafts that might still change substantially)
- [ ] You have the full body of the post in front of you
- [ ] You know the **primary keyword** and **post title**
- [ ] You know the **client's brand palette** if they have one — pull from their website if needed
- [ ] You have a folder open on your machine called `{client-slug}/{post-slug}/` to save outputs

---

## Step 1 — Generate the visual brief (Claude, ~5 min)

The brief is the contract every downstream prompt references. Generate it once and save it.

**1a.** Open Claude (claude.ai or in this platform's content draft preview).

**1b.** Paste this prompt, filling in the variables:

```
You are an art director helping me generate cohesive images for a blog post.
Read the post below and produce a STRUCTURED VISUAL BRIEF as JSON.

POST TITLE: {paste title}
PRIMARY KEYWORD: {paste keyword}
CLIENT BUSINESS: {client name + one-line description}
CLIENT BRAND PALETTE (if known): {paste hex codes or leave blank}

POST BODY:
"""
{paste full body}
"""

Return ONLY valid JSON, no prose, in this exact shape:

{
  "primaryEntity": "the single most important visual subject — who or what the lead image should show, including setting",
  "styleDescriptor": "one phrase: e.g. 'clean editorial photography', 'natural light photography', 'modern flat illustration', 'documentary-style'. Pick one that fits the topic's tone.",
  "colorPalette": ["3-5 hex codes with short descriptors, derived from the brand palette if provided, otherwise from the topic"],
  "composition": "how to frame the lead image: 'shallow depth of field, subject foreground, environment soft-focus' or similar",
  "mood": "two-word mood: e.g. 'calm urgency', 'reassuring expertise', 'warm authority'",
  "lighting": "lighting note: 'natural daylight', 'warm golden-hour', 'soft overhead studio'",
  "avoid": "what NOT to do: 'no stock-photo handshakes, no AI sheen, no cartoon style, no fake-looking text'",
  "pullQuoteCandidates": [
    "3 short impactful sentences from the post (under 14 words each) that would work as standalone shareable quotes"
  ],
  "inlineImageConcepts": [
    "3-5 distinct visual concepts, one per major section of the post — describe the SUBJECT and SCENE for each, NOT the style (the style is shared)"
  ]
}
```

**1c.** Save the JSON output to `{client-slug}/{post-slug}/brief.json` in your folder. This is now your reference document for the rest of the SOP.

**Quality check:** does the `styleDescriptor` actually fit the topic? An emergency HVAC repair post shouldn't get "playful illustration." If it's off, ask Claude to revise: *"Adjust the styleDescriptor to be more {appropriate} for this topic."*

---

## Step 2 — Generate the hero image (Gemini, ~5 min)

The hero is generated first because it becomes the style anchor for everything else.

**2a.** Open Gemini (gemini.google.com) or AI Studio. Make sure the model is **Gemini 2.5 Flash Image** (Nano Banana). In the Gemini app, this is the default for image gen; in AI Studio, select it explicitly.

**2b.** Paste this prompt, substituting from your brief:

```
{styleDescriptor}. {primaryEntity}, in a {composition} composition.
{mood}, {lighting}. Color palette: {colorPalette joined with commas}.
Photorealistic, editorial quality, high detail. Aspect ratio 16:9.
Do NOT include text, watermarks, or logos in the image.
Avoid: {avoid}
```

**2c.** Generate. Evaluate against these checks:

- [ ] Does it look **editorial**, not like a generic stock photo?
- [ ] Is the **palette right** — pulling the colors you specified?
- [ ] Does the **subject match** the post topic?
- [ ] No AI artifacts (extra fingers, melting text, distorted faces)?
- [ ] No watermarks or accidental text overlay?

**2d.** If it's off:
- *Subject wrong:* "Regenerate with a different subject: {more specific description}"
- *Style off:* "Make it look more {documentary / editorial / candid}. Less polished, more authentic."
- *Palette off:* "Shift the palette toward {specific color}, away from {wrong color}."
- *AI sheen:* "Less hyperreal. More natural skin tones, real-world imperfections, photograph-like grain."

**2e.** When you're happy, **download the image** and save as `{post-slug}-hero.png` in your folder. This file is now the reference for every subsequent step.

---

## Step 3 — Open Graph (Facebook / LinkedIn / X) card (~3 min)

This is a reframe of the hero with the post title overlaid.

**3a.** Start a new chat with Gemini (or continue the same one). Upload your saved hero image.

**3b.** Prompt:

```
Use this image as the visual style reference. Generate a new image with
the same palette, lighting, and treatment, sized as a 1200×630 horizontal
social card (Facebook / X / LinkedIn Open Graph).

Composition: subject occupies the left two-thirds. The right third should
be a soft, gentle gradient overlay in {primary palette color} where text
will be placed.

Overlay the title text "{post title}" on the right third in a clean,
bold sans-serif. Center it vertically. Use white or off-white text on
the gradient. Keep the title legible at thumbnail size.

Bottom-right corner: small "{client business name}" text mark in matching
sans-serif, half the size of the title.

Do NOT add other decorative elements. Do not add a tagline or subtitle.
```

**3c.** Quality check:
- [ ] Title readable at small size? (Imagine seeing it in a Facebook share preview — about 3" wide on a phone)
- [ ] Hero subject visible and not crowded by text?
- [ ] Brand mark legible but unobtrusive?
- [ ] Same visual feeling as the hero?

**3d.** Common fixes:
- Title too small: "Make the title text 25% larger."
- Text on busy background: "Strengthen the gradient overlay — make it more opaque so the title has higher contrast."
- Wrong typography: "Use a heavier, bolder sans-serif — something like Inter Bold or Manrope Black."

**3e.** Save as `{post-slug}-og.png`.

---

## Step 4 — Pinterest pin (~5 min)

Pinterest is the most typography-heavy. The image is essentially a visual headline; the photograph is supporting.

**4a.** New chat or continue. Upload the hero again as the style reference.

**4b.** Prompt:

```
Use this image as the visual style reference. Generate a vertical
1000×1500 Pinterest pin (2:3 aspect ratio) with the same palette and
lighting.

Layout:
- Top 55%: a vertically-cropped version of the reference scene in
  the same visual style.
- Bottom 45%: a solid panel in {primary palette color}.
- On the panel, render the title "{post title}" in a bold serif font,
  centered, broken across 2-3 lines.
- Below the title, render the subtitle "{shortest pullQuoteCandidate}"
  in a thinner sans-serif, smaller.
- Tiny brand mark "{client business name}" at the very bottom,
  centered, small.

Use high contrast — white or off-white text on the colored panel.
Pin must be legible at thumbnail size (about 1.5 inches wide).
```

**4c.** Quality check:
- [ ] Title readable at thumbnail (Pinterest mobile feed is small)?
- [ ] Image and text panel feel like one designed pin, not two pieces stitched?
- [ ] Brand mark present but not dominating?

**4d.** Save as `{post-slug}-pinterest.png`.

---

## Step 5 — Inline body images (~10–15 min for 3–5 images)

One per major H2 section, or one per concept in `inlineImageConcepts` from the brief. These are the workhorse images.

**5a.** New chat. Upload the hero as style reference.

**5b.** For each concept in `inlineImageConcepts[]`, prompt:

```
Use this image as the visual style reference — same palette, lighting,
treatment, mood. Generate a NEW image with a DIFFERENT subject:

Subject: {inlineImageConcepts[i]}
Composition: {composition from brief, possibly adjusted for the specific subject}
Aspect ratio: 16:9 (1200×675)

Do NOT include text overlay, watermarks, or logos.
Match the style of the reference exactly, but the scene is new.
```

**5c.** After each generation, check:
- [ ] Does it feel like it's from the same photo shoot / illustration set as the hero?
- [ ] Is the subject specific to the section it'll illustrate, not generic?
- [ ] No text artifacts?

**5d.** Save each as `{post-slug}-inline-1.png`, `-inline-2.png`, etc.

**Tip:** if the set starts drifting (image #3 feels different from #1 and the hero), start a fresh chat and re-upload the hero. Long chats can lose the style reference.

---

## Step 6 — Pull-quote graphics (~3 min each, do 1–3)

These are square (1080×1080) for embedding in post AND for Instagram/social distribution.

**6a.** New chat. Upload the hero as style reference.

**6b.** For each pull-quote (start with the strongest one, regenerate the others only if you need them):

```
Use this image as the visual style reference for palette and mood.

Generate a 1080×1080 square social quote graphic:
- Background: a soft, abstract, blurred version of the reference scene
  in the same palette — defocused so it's clearly a background.
- Dark gradient overlay (40-50% opacity) so foreground text is readable.
- Center the quote text in large bold serif, white or off-white:
  "{pullQuoteCandidate}"
- Below the quote, attribution in smaller text:
  "— {client business name}"
- Small brand mark in the bottom-right corner.

Keep the design minimal and editorial — let the quote be the star.
```

**6c.** Quality check:
- [ ] Quote readable at small size (Instagram feed thumbnail)?
- [ ] Background doesn't compete with the text?
- [ ] Visually consistent with the hero?

**6d.** Save as `{post-slug}-quote-1.png`, etc.

---

## Step 7 — Alt text and filenames (Claude, ~5 min)

The most-skipped step. SEO and accessibility require descriptive alt text on every image. Don't ship without this.

**7a.** Upload all your saved images to Claude in one message.

**7b.** Prompt:

```
For each of these blog post images, write:
1. An alt text under 125 characters — descriptive (what's in the image),
   not promotional, suitable for screen readers
2. A filename in kebab-case, ending in the kind, e.g.
   "same-day-hvac-repair-hero", "same-day-hvac-repair-og"

POST TITLE: {paste title}
PRIMARY KEYWORD: {paste keyword}

For each image I upload, return ONE row:
[filename] | [alt text]

Map the images to these kinds in the order I'm uploading them:
1. hero
2. og
3. pinterest
4-N. inline-1, inline-2, ...
N+1...end. quote-1, quote-2, ...
```

**7c.** Save the output to `{client-slug}/{post-slug}/alt-text.txt`. You'll paste these into WordPress as you upload.

---

## Step 8 — Optimize the images (~3 min)

PNG output from Gemini is bigger than it needs to be. Compress before upload.

**8a.** Open **Squoosh** (squoosh.app) or **TinyPNG** (tinypng.com).

**8b.** Convert each image to **WebP** at ~80% quality. Most images should drop from 1–3 MB → 100–300 KB.

**8c.** Rename each file to the kebab-case filename from Step 7 with the `.webp` extension.

**8d.** Result: a folder of optimized, properly-named WebP files ready to upload.

---

## Step 9 — Upload to WordPress (~5 min)

**9a.** In WordPress media library, upload all images. For each, paste the **alt text** from Step 7 into the alt-text field at upload time. *Don't skip this — you'll forget and they'll ship without alt text.*

**9b.** In the post editor:
- Set the **hero** as the Featured Image
- Set the **OG** as the Facebook Open Graph image (Yoast / Rank Math social tab)
- Set the **Pinterest pin** as the Pinterest-specific image (Yoast / Rank Math, or the post itself for Pinterest's pin-it button to find)
- Insert **inline images** at the start of their corresponding H2 sections — aligned center, "Large" or "Full" size
- Insert **pull-quote graphics** after the paragraph containing the quoted sentence, center-aligned

**9c.** Preview the post. Check that:
- [ ] Featured image renders at the top
- [ ] Inline images appear in their sections with proper spacing
- [ ] Pull-quote graphics break up long copy
- [ ] OG preview (use Facebook Sharing Debugger or LinkedIn Post Inspector) loads the right image
- [ ] Pinterest preview (use Pinterest's pin builder or paste the URL into the pin-it bookmarklet) loads the pin image

---

## Quality bar — what "good" looks like

A finished set should pass all of these:

- [ ] **Coherence:** All 8–11 images feel like they're from the same shoot or design set. Same palette, same lighting style, same level of stylization.
- [ ] **Relevance:** Hero and inline images depict subjects that actually relate to the post's content, not just "people doing business things."
- [ ] **Legibility:** Text on the OG and Pinterest reads clearly at thumbnail size. Open them in Finder thumbnail view to test.
- [ ] **No AI artifacts:** No melting text, six-fingered hands, distorted faces. Hands and faces are where AI generators fail most often — inspect closely.
- [ ] **No watermarks or accidental text:** Gemini sometimes hallucinates words on signs or labels. Zoom in on any signage in the image.
- [ ] **Brand mark consistency:** OG, Pinterest, and pull-quote graphics all show the client's name in the same place, same treatment.

If any of these fail on more than one image, **regenerate with the failing fix**, don't ship.

---

## Common failure modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Set looks incoherent across images | Long Gemini chat lost the style reference | Start a fresh chat for each asset, re-upload the hero |
| Hero looks like generic stock | Style descriptor too vague | Refine `styleDescriptor` in the brief; rerun Step 2 |
| Text on OG/Pinterest unreadable at thumbnail | Font too thin, contrast too low | Re-prompt: "make the title heavier weight and the gradient overlay more opaque" |
| Inline images all show the same scene | Concepts in the brief were too similar | Ask Claude to regenerate the brief with "more distinct visual concepts, each showing a different setting or subject" |
| Pull-quote text mangled or misspelled | Gemini struggles with quote-heavy text rendering | Use shorter quotes (under 12 words); regenerate; if it still fails, render the quote in Canva over a Gemini-generated background |
| Faces look weird in close-ups | AI face artifacts at close range | Pull the composition wider — "subject in mid-shot, not close-up" |
| Brand mark looks fake | Gemini renders custom text imperfectly | Skip the brand mark in Gemini; add it in Canva after as a vector overlay |

---

## When to deviate from this SOP

- **Image-heavy listicle posts:** generate more inline images (one per list item) instead of pull quotes.
- **How-to / step-by-step posts:** the inline images become **step diagrams** — adjust the inline concept prompts to describe each step's visual.
- **Comparison posts:** consider a single side-by-side comparison graphic as the hero instead of a single subject.
- **Local-business posts heavily tied to a city:** use a recognizable local landmark in the hero if the brief supports it ("Westminster CO street with mountain backdrop"). Don't force this if it feels gimmicky.
- **Client provided actual photography:** skip the hero generation and use the client's photo as the style reference for everything else. Their photo becomes the anchor.

---

## Cost notes

- Gemini 2.5 Flash Image is roughly **$0.03 per image** at standard quality (as of writing — verify against current Google AI pricing).
- A full set of ~10 images = **~$0.30 per post**.
- Regeneration is the cost driver. If you're regenerating 3+ times per asset, the brief is wrong — go back and fix the brief, not the prompt.

---

## Future automation note

When this gets built into the platform (see `docs/DECISIONS.md` Path B / future work), the workflow will collapse to a single button on the draft review screen. The brief extraction, generation, alt-text, and WordPress upload will all happen in one flow. Until then, this manual SOP gets you the same quality output with about 30–45 minutes of clicking.
