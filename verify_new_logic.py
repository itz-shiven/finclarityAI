
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
            return True
    if len(text_lower.split()) <= 2 and any(word in text_lower for word in ["hi", "hey", "hello"]):
        return True
    return False

def is_small_talk_or_identity_query(text):
    text_lower = (text or "").lower().strip()
    if is_greeting(text_lower): return True
    patterns = [r"\bwho are (you|u)\b", r"\bwhat can you do\b", r"\bhelp\b"]
    return any(re.search(pattern, text_lower) for pattern in patterns)

def is_suggestion_query(text):
    text_lower = (text or "").lower().strip()
    patterns = [r"\bsuggest\b", r"\brecommend\b", r"\bbest\b", r"\bwhich one\b"]
    return any(re.search(pattern, text_lower) for pattern in patterns)

def mock_chat_logic(message, chat_mode, has_docs):
    model_label = "Free" if chat_mode == "free" else "Pro"
    small_talk = is_small_talk_or_identity_query(message)
    is_suggest = is_suggestion_query(message)
    
    if model_label == "Free" and is_suggest:
        return "REFUSE: Upgrade to Pro for suggestions"
    
    if not has_docs and small_talk:
        return "SAFE_SMALL_TALK_REPLY"
        
    if not has_docs:
        return "REFUSE: Just Database (No docs found)"
        
    return "PROCEED_TO_LLM (Docs found)"

test_cases = [
    ("hi", "free", False, "SAFE_SMALL_TALK_REPLY"),
    ("how to go to chandigarh?", "free", False, "REFUSE: Just Database (No docs found)"),
    ("suggest a card", "free", False, "REFUSE: Upgrade to Pro for suggestions"),
    ("suggest a card", "pro", True, "PROCEED_TO_LLM (Docs found)"),
    ("hdfc card features", "free", True, "PROCEED_TO_LLM (Docs found)"),
    ("what is inflation?", "free", False, "REFUSE: Just Database (No docs found)"),
]

print("Running Logic Verification...")
for msg, mode, docs, expected in test_cases:
    res = mock_chat_logic(msg, mode, docs)
    status = "OK" if res == expected else "FAIL"
    print(f"{status} Q: '{msg}' | Mode: {mode} | Docs: {docs} | Result: {res}")
