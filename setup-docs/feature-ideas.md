# feature-ideas.md — Carrot Wall challenge backlog

Pick any feature, size it with the routing questions, run the loop that fits, deliver however you see fit. Nothing here is fancy on purpose — the point is the *way* you build, not what. Invent your own if none appeal; just size it first.

Legend: suggested tier per the Sized Loop (your judgment overrules). "Touches" hints at surfaces involved.

## Tier 1 — direct changes (describe the diff in one sentence)
1. Ctrl+Enter submits the post form. *(web)*
2. Character counter turns terracotta at 260/280. *(web)*
3. Timestamps render in pt-PT locale, relative ("há 5 min"). *(web)*
4. Page title + favicon. *(web)*
5. Footer with the public repo link. *(web)*
6. Newest/oldest sort toggle on the wall. *(web)*
7. Loading skeletons instead of a spinner. *(web)*
8. Hover state on cards (hairline darkens, no shadow). *(web)*
9. Empty-state copy + illustration when the wall has no posts. *(web)*
10. README quickstart section: both apps, one screen. *(docs)*

## Tier 2 — small features (plan mode; a few files, one module)
11. Filter chips by post type (client-side). *(web)*
12. Search box filtering messages as you type. *(web)*
13. Dark mode toggle (persisted in localStorage), tokens swapped. *(web)*
14. Edit window: authors can edit their own post for 5 minutes (localStorage token). *(web + api)*
15. Delete-own-post within the same window. *(web + api)*
16. CSV export of all posts (admin only). *(api + admin)*
17. Permalink view for a single post (`/post/:id`). *(web + api)*
18. Reactions beyond +1: pick 3 emoji, one reaction per browser per post. *(web + api)*
19. Admin mini-analytics: counts by type and by day, one simple page. *(api + admin)*
20. Pin cap: max 3 pinned; pinning a 4th auto-unpins the oldest. *(api)*
21. Friendlier rate-limit UX: countdown until next allowed post. *(web + api)*
22. EN/PT language toggle (strings centralized already). *(web)*
23. Pagination or infinite scroll past 50 posts. *(web + api)*
24. Gentle sound (toggleable) on new post in TV mode. *(web)*

## Tier 3 — features with touchpoints (spec → plan → gate; crosses surfaces)
25. Moderation queue: new posts held as "pending" until admin approves/rejects; wall shows approved only; TV unaffected. *(api + web + admin + data model)*
26. Attendee replies: threaded responses under posts (instructor answer stays distinct). *(api + web + admin + model)*
27. Replace polling with SSE live updates, with polling fallback. *(api + web)*
28. Scheduled prompts: prompts auto-rotate on a timetable the admin sets. *(api + admin + model)*
29. Upvote leaderboard + "top of the day" digest view. *(api + web)*
30. Print/export view: the wall as a clean A4 "session summary" (posts + answers grouped by prompt). *(web + api)*
31. Multi-admin: named instructor accounts instead of one PIN, answers attributed. *(api + admin + model + security surface)*
32. Presence counter: "N people viewing" via lightweight heartbeat. *(api + web)*

> Sizing reminder: if you can describe the diff in one sentence, skip the plan. If it crosses surfaces or someone reviews it cold, write the spec first. Everything in Tier 3 deserves committed artifacts.
