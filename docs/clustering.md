# Story clustering and ranking

The MVP uses deterministic clustering so review behavior is explainable and does not depend on a particular model provider.

## Clustering

Titles are normalized to lowercase tokens, punctuation and common filler words are removed, and entries published more than five days apart are never grouped. Two entries cluster when their title-token Jaccard similarity is at least `0.42`, or when at least three meaningful tokens overlap and cover at least 60% of the shorter title.

The cluster ID is the lowest database story ID among its members. This makes the ID stable for the current dataset and lets the CLI approve or reject every supporting story together.

## Ranking

The cluster starts with the highest individual story score. Each additional independent source adds six corroboration points, capped at eighteen points. The final score is capped at 100.

This is deliberately conservative. Multiple posts from the same publisher do not earn a corroboration bonus. A later semantic clustering adapter can supplement this baseline, but manual review remains authoritative.

## Manual review

`review` displays one candidate per cluster with its categories, number of sources, number of articles, representative summary, and every source URL. `approve` and `reject` accept cluster IDs and update all stories in those clusters.
