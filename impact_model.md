# FinclarityAI Impact Model

## What The Product Improves

FinclarityAI is aimed at reducing the effort required to discover, compare, and understand financial products. In its current form, the product creates value in four practical ways:

- faster product discovery through search and comparison
- lower friction for basic financial research through chat
- centralized personal finance organization through todos, goals, and expenses
- easier access for new users through guest mode and social login

## Present-Day Impact Areas

### 1. Research Time Saved

Instead of manually opening multiple bank pages, users can:

- ask the chat assistant for grounded answers from the indexed database
- compare products side by side
- open structured product-detail views generated from retrieved source content

Expected effect:
- fewer tabs opened
- less repeated searching
- faster first-pass decision making

### 2. Better Shortlisting

The strongest current product value is not full financial advice. It is structured shortlisting.

Users can:

- compare fees, benefits, and eligibility at a glance
- identify obvious mismatches earlier
- narrow choices before visiting official issuer pages

Expected effect:
- less overwhelm
- better initial filtering
- fewer poor-fit product selections

### 3. Ongoing Personal Organization

The dashboard now includes a finance data layer stored in Supabase:

- `todos`
- `goals`
- `expenses`

Expected effect:
- action items stay attached to the user account
- users can move from research to execution inside the same app

### 4. Accessibility

The app lowers access barriers with:

- guest mode
- social login support
- conversational UX
- calculators for common finance scenarios

Expected effect:
- easier onboarding for non-experts
- lower intimidation for users who are not comfortable with financial jargon

## Realistic Impact Assumptions

Because the present codebase is still hackathon-stage, the most credible impact model is directional rather than revenue-perfect.

Reasonable early assumptions:

- A user can save 10 to 30 minutes on one product research session.
- Users benefit most when the indexed database contains the products they are asking about.
- The value is highest for comparison-heavy tasks such as cards, loans, and account evaluation.

## Key Constraints On Impact

- Answer quality depends on the quality and freshness of `financial_docs`.
- If retrieval returns no matching documents, the chatbot intentionally refuses to answer.
- The scraper and indexing pipeline are not yet an always-on production ingestion system.
- No automated testing or formal analytics instrumentation is present yet.
- Some dashboard sections are more polished than others, so user value is uneven across the app.

## How To Measure Impact Going Forward

If the team continues this project, the best next metrics would be:

- chat success rate on first question
- compare flow completion rate
- product detail view engagement
- percentage of users creating todos/goals after research
- repeat sessions per signed-in user
- number of retrieval misses caused by missing database coverage

## Bottom Line

Today, FinclarityAI’s strongest measurable promise is:

- helping users reach a useful shortlist faster
- keeping finance research and action items in one place
- making financial product exploration more approachable

The app already shows product-market direction, but its long-term impact will depend on stronger data coverage, fresher ingestion, and production hardening.
