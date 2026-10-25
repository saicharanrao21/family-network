# Phase 6 — Search, Name Intelligence & Discovery

## Completed scope
- Family-scoped person search across the complete confirmed connected graph, not a fixed generation depth.
- Name normalization using Unicode decomposition, punctuation/spacing normalization and case folding.
- Alternate-name aware matching for legal, birth, maiden, married, former, nickname, family-used, alternate-spelling and transliteration records already supported by the schema.
- Ranked search results with match reasons.
- Surname-variant suggestions across a user's connected family graph, including historical/alternate names such as a mother's maiden or former surname.
- Relationship-target search endpoint for selecting a person before asking the relationship engine for a path/kinship result.
- Privacy-safe scope: search never crosses outside the user's verified connected family graph.
- No automatic person merges from name similarity; matching remains a reviewable candidate workflow.

## APIs
- `GET /search/people?q=&limit=`
- `GET /search/surname-suggestions?personId=&limit=`
- `GET /search/relationship-targets?q=`

## Design decision
Name similarity is a discovery signal, never proof of identity. The canonical Person and confirmed relationship graph remain authoritative.
