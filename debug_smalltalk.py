
import re

def is_greeting(text):
    greetings = [
        r"\bhi\b", r"\bhello\b", r"\bhey\b", r"\bgood morning\b", 
        r"\bgood afternoon\b", r"\bgood evening\b", r"\bhow are you\b",
        r"\bwho are you\b", r"\bwho r u\b", r"\bwho are u\b", r"\bwhat are you\b",
        r"\bthanks\b", r"\bthank you\b", r"\bnamaste\b", r"\bhii+\b", r"\bhelo+\b"
    ]
    text_lower = text.lower().strip()
    for pattern in greetings:
        if re.search(pattern, text_lower):
            return True, f"greeting_pattern ({pattern})"
    
    if len(text_lower.split()) <= 2 and any(word in text_lower for word in ["hi", "hey", "hello"]):
        return True, "short_greeting"
    return False, None

def is_small_talk_or_identity_query(text):
    text_lower = (text or "").lower().strip()
    greeting, pat = is_greeting(text_lower)
    if greeting:
        return True, f"greeting ({pat})"

    patterns = [
        r"\bwho are (you|u)\b",
        r"\bwhat can you do\b",
        r"\bwhat do you do\b",
        r"\btell me about yourself\b",
        r"\bhow does this work\b",
        r"\bare you ai\b",
        r"\bwhat is finclarity\b",
        r"\bhelp\b"
    ]
    for p in patterns:
        if re.search(p, text_lower):
            return True, f"small_talk_pattern ({p})"
    return False, None

query = "how to go to chandigarh?"
res, pattern = is_small_talk_or_identity_query(query)
print(f"Query: '{query}'")
print(f"Small Talk Result: {res}")
print(f"Matched pattern: {pattern}")
