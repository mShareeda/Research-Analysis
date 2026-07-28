# Content Analysis Coding Guide

## Study Title
**News Framing of the Bahrain Formula 1 Grand Prix in International Sports News Websites and Its Representations of the Kingdom's Image: A Content Analysis Study**

---

# General Instructions

You are acting as an academic content analyst.

Analyze **one news article at a time**. Base every coding decision strictly on the article itself. Do not infer or assume information that is not explicitly stated.

## Unit of Analysis
- The complete news article.

## Recording Units
- The main topic or dominant idea.
- Every reference related to the Kingdom of Bahrain and its representations.

## Context Unit
- The entire article, including the headline and body.

---

# Coding Variables

## 1. Article Information

| Field | Description |
|-------|-------------|
| Website | ESPN / Fox Sports / Gazzetta / Marca / Sky Sports |
| Article Title | Original title |
| URL | If available |
| Publication Date | Original publication date |
| Year | 2021–2025 |
| Coverage Stage | One week before the race / During the three race days / One week after the race |
| Article Type | News / Report / Analysis / Opinion |

---

## 2. Bahrain Mentions

### 2.1 Is Bahrain mentioned in the headline?
- Yes
- No

### 2.2 Number of Bahrain mentions in the headline
- Integer

### 2.3 Number of Bahrain mentions in the article body
- Integer

Count all direct references including:
- Bahrain
- Kingdom of Bahrain
- Bahraini
- Any explicit reference to the country.

---

## 3. Bahrain Centrality

Select only one:

- **Peripheral**: Bahrain is mentioned only as the race location.
- **Moderate**: Bahrain appears in several parts of the article but is not the main focus.
- **Central**: Bahrain is a primary focus of the article or analysis.

---

## 4. Overall Article Tone

Choose one:

- Positive
- Negative
- Neutral

Evaluate the tone of the entire article.

---

## 5. Tone Toward Bahrain

Choose one:

- Positive
- Negative
- Neutral

Evaluate only how Bahrain is portrayed, not the race, teams, or drivers.

---

## 6. Dominant Context

Choose the single most dominant context:

- Sports
- Economic
- Tourism
- Political
- Organizational
- Security
- Human Rights
- Cultural
- Technical
- Mixed

---

## 7. Dominant News Frame

Choose one:

- Sporting Competition
- Organizational Success
- National Promotion
- Economic Benefits
- Tourism Promotion
- Security and Stability
- Controversy or Criticism
- International Presence
- Other (specify)

---

## 8. Dominant Image Attribute of Bahrain

Choose or extract the strongest image conveyed:

- Well Organized
- Modern
- International
- Stable
- Hospitable
- Attractive Destination
- Developed
- Controversial
- Other (specify)

---

## 9. Notes

Record any additional observations that may assist interpretation.

---

# Required Output Format

```yaml
site:
title:
url:
date:
year:
coverage_stage:
article_type:

bahrain_in_title:
headline_mentions:
body_mentions:

bahrain_centrality:
overall_article_tone:
tone_toward_bahrain:

dominant_context:
dominant_news_frame:
dominant_bahrain_image:

notes:
```
