def generate_decision(docs, user_query, user_memory):
    print("🔥 DECISION ENGINE CALLED")
    if not docs:
        return ""

    decision_points = []
    verdict = "⚖️ Neutral"

    for doc in docs:
        content = doc.get("content", "").lower()

        if "high annual fee" in content:
            decision_points.append("❌ High annual fee — not ideal")

        if "cashback" in content:
            decision_points.append("✅ Good for daily spending")

        if "lounge" in content:
            decision_points.append("✈️ Good for travel")

    decision_points = list(set(decision_points))

    if any("❌" in p for p in decision_points):
        verdict = "⚠️ Conditional"
    elif any("✅" in p for p in decision_points):
        verdict = "✅ Recommended"

    if not decision_points:
        return ""

    return (
        "### 🧠 Final Recommendation\n"
        + "\n".join([f"- {p}" for p in decision_points])
        + f"\n\n**Verdict:** {verdict}"
    )