# Source coverage

Status verified on 2026-08-26.

| Report source | MVP connector | Status | Notes |
| --- | --- | --- | --- |
| Simon Willison's Weblog | Atom | Enabled | Long-form entries feed |
| Last Week in AI | Podcast RSS | Enabled | Episode metadata and show notes |
| Latent Space | RSS | Enabled | Newsletter and podcast posts |
| TLDR AI | Dedicated connector needed | Deferred | Public feed endpoint rejects automated access |
| Import AI | RSS | Enabled | Substack publication feed |
| AlphaSignal | RSS | Enabled | Substack publication feed |
| Practical AI | Podcast RSS | Enabled | Episode metadata and show notes |
| The TWIML AI Podcast | Podcast RSS | Enabled | Episode metadata and show notes |
| Ben's Bites | RSS | Enabled | Substack publication feed |
| AI Explained | YouTube Atom | Enabled | Video titles and descriptions; captions are not yet fetched |
| Product Hunt | Atom | Configured, disabled | Official main feed is not limited to the AI topic; needs filtering |

The ingestion layer stores metadata and publisher-provided summaries. It does not yet download audio, transcribe episodes, fetch YouTube captions, or retrieve the full text behind every linked article.
