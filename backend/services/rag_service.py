from services.embedding_service import get_embedding
from services.vector_service import search_documents

def retrieve_context(message, history, chat_mode="pro"):
    try:
        # Use ONLY the message for search to avoid history bias
        context_text = message

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