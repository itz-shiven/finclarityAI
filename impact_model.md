# FinclarityAI Impact Model

## Present Value Proposition

FinclarityAI currently helps users do three things faster:

- understand financial products
- shortlist options
- turn research into tracked next steps

Its strongest present-day value is not autonomous advice. It is structured, retrieval-backed assistance inside one dashboard.

## Where The Product Creates Impact Today

### 1. Faster Product Research

Users can:

- ask finance questions in chat
- get grounded answers when matching records exist in `financial_docs`
- compare products without manually scanning multiple issuer pages
- open deeper product-detail views generated from retrieved context

Likely effect:

- fewer tabs opened
- less repeated searching
- faster first-pass understanding

### 2. Better Shortlisting

The current product is especially useful at the shortlist stage.

Users can:

- compare fees, benefits, eligibility, and trade-offs
- filter obvious mismatches earlier
- move from broad interest to a smaller set of candidates

Likely effect:

- lower decision fatigue
- fewer bad-fit options in the consideration set
- more confidence before visiting official issuer pages

### 3. Research-To-Action Continuity

The dashboard now stores:

- todos
- AI-generated task suggestions
- goals
- expenses

Likely effect:

- research does not end as a dead conversation
- users can capture follow-up actions in the same product
- short-term planning stays attached to the same account state

### 4. Lower Onboarding Friction

Accessibility comes from:

- guest mode
- social sign-in options
- conversational UI
- built-in calculators

Likely effect:

- easier first session for non-experts
- lower friction before account creation
- better usability for users who are uncomfortable with financial jargon

### 5. Premium Monetization Potential

The repository now includes a real premium upgrade path through Stripe.

Present implication:

- the product is no longer only a demo flow
- the app can distinguish free versus premium usage patterns
- premium can be measured as a willingness-to-pay signal once traffic exists

## Reasonable Current Assumptions

At the current maturity level, the most defensible assumptions are operational, not grand-market ones.

Reasonable near-term assumptions:

- one successful research session can save roughly 10 to 30 minutes
- value is highest when the requested products exist in `financial_docs`
- product comparison, card research, and loan evaluation are likely the clearest early use cases
- premium value will depend on whether users perceive `pro` mode and unlimited task workflows as meaningfully better than free mode

## Main Constraints On Impact

- answer quality depends on the freshness and coverage of `financial_docs`
- the ingestion pipeline is still manual, not always-on
- no committed analytics layer is visible in the repository yet
- no automated test suite is present
- some impact depends on external configuration being correct, including Supabase, OpenAI, OpenRouter, and Stripe
- the app still mixes several product concerns into a single large dashboard flow, which can make quality uneven

## What Should Be Measured Next

If the team continues the project, the most useful present-focused metrics would be:

- first-question chat success rate
- retrieval miss rate
- compare flow completion rate
- product detail view usage rate
- guest-to-signup conversion
- signup-to-premium conversion
- number of todo/goals created after a research session
- repeat weekly sessions per active user

## Bottom Line

Today, FinclarityAI's clearest impact promise is:

- helping users reach a useful shortlist faster
- keeping research and next actions in one place
- making financial product exploration feel more approachable

That is already meaningful for a hackathon-stage product. The next jump in impact will come from better data coverage, clearer measurement, and production hardening rather than from adding more conceptual architecture.
