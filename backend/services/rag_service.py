from services.embedding_service import get_embedding
from services.vector_service import search_documents

def retrieve_context(message, history, chat_mode="pro"):
    try:
        # Combine history (same logic as yours)
        context_text = message
        if history:
            recent = "\n".join([
                f"{msg.get('role')}: {msg.get('content')}"
                for msg in history[-4:]
            ])
            context_text = f"{recent}\n\nUser: {message}"

        embedding = get_embedding(context_text)
        if not embedding:
            return [], "embedding_failed"

        docs = search_documents(embedding, chat_mode)

        filtered_docs = [
            doc for doc in docs
            if float(doc.get("similarity", 0)) >= 0.45
        ]

        return filtered_docs, "success"

    except Exception as e:
        print(f"[RAG Error] {e}")
        return [], "error"