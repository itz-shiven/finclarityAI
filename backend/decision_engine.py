def generate_decision(docs, user_query, user_memory):
    """
    Generates a final recommendation based on:
    - retrieved docs
    - user query
    - user profile
    """

    if not docs:
        return ""

    query = user_query.lower()
    memory = " ".join(user_memory).lower() if user_memory else ""

    decision_points = []
    verdict = "⚖️ Neutral"

    # Heuristics
    for doc in docs:
        content = doc.get("content", "").lower()

        if "high annual fee" in content:
            decision_points.append("❌ High annual fee — not ideal for low usage")

        if "cashback" in content:
            decision_points.append("✅ Good for everyday spending")

        if "lounge access" in content:
            decision_points.append("✈️ Great for travel benefits")

        if "low interest" in content:
            decision_points.append("✅ Suitable for loans/EMI usage")

    # User-based personalization
    if "low salary" in memory or "30k" in memory or "40k" in memory:
        decision_points.append("⚠️ Might not be ideal for lower income users")

    if "travel" in query:
        decision_points.append("✈️ Recommended if you travel frequently")

    # Verdict logic
    if any("❌" in p for p in decision_points):
        verdict = "⚠️ Conditional"
    if any("✅" in p for p in decision_points) and not any("❌" in p for p in decision_points):
        verdict = "✅ Recommended"

    decision_points = list(set(decision_points))

    if not decision_points:
        return ""

    return (
        "### 🧠 Final Recommendation\n"
        + "\n".join([f"- {p}" for p in decision_points])
        + f"\n\n**Verdict:** {verdict}"
    )