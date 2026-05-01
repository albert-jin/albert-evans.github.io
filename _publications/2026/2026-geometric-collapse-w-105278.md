---
title: "Geometric Collapse: When Vision Models Fail to Verify Physical Causality (ICML 2026)"
date: "2026-05-01 00:00:00 +0800"
pub_post: "| Published:"
links:
  "Geometric Collapse's OpenReview": "https://openreview.net/forum?id=XX9TQRWZOx"
---

Recent progress in large-scale self-supervised learning has improved dense geometric prediction, but it remains unclear whether such scaling yields inference-time physical plausibility checks. We propose Scrambled Edges, a controlled counterfactual that injects salient edge-like cues while violating surface continuity, illumination coherence, and occlusion ordering. With energy-matched and structure-matched controls, we isolate the effect of unsupported edge evidence from high-frequency energy and edge sparsity. Across CNN/ViT/SSL depth predictors on NYU Depth v2 and KITTI, Scrambled Edges induce up to 3.2× larger deviation from clean predictions than energy-matched noise. The resulting Geometric Collapse propagates globally: even with oracle knowledge of the corrupted region, output-level repair recovers only 47%, with substantial error outside the mask. These findings provide controlled behavioral evidence that current dense predictors lack reliable mechanisms to quarantine physically unsupported edge cues, motivating explicit plausibility scoring and selective cue integration.
