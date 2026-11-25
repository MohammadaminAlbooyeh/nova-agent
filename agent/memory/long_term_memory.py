import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from agent.memory.retrieval_strategy import Memory, StrategySelector
from agent.utils.logger import get_logger

logger = get_logger(__name__)


class LongTermMemory:
    def __init__(self, storage_path: str = "memory_store.json", embedding_service=None, vector_store=None, max_memories: int = 1000):
        self.storage_path = storage_path
        self._storage = {}
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.strategy_selector = StrategySelector(embedding_service, vector_store)
        # Without a cap, every store() call grows memory_store.json and the
        # vector store forever. consolidate() keeps this bounded by dropping
        # exact-duplicate values and, if still over the cap, the
        # least-recently/least-often used entries.
        self.max_memories = max_memories
        self._load()

    def _load(self) -> dict:
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)
                    for key, value in data.items():
                        self._storage[key] = Memory(key=key, value=value)
            except Exception as e:
                logger.error(f"Failed to load memory: {e}")
        return self._storage

    def _save(self):
        try:
            data = {key: mem.value for key, mem in self._storage.items()}
            with open(self.storage_path, "w") as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save memory: {e}")

    async def store(self, key: str, value: any, metadata: dict = None):
        memory = Memory(key=key, value=value, metadata=metadata)
        self._storage[key] = memory

        if self.embedding_service and self.vector_store:
            try:
                embedding = await self.embedding_service.embed_text(str(value))
                await self.vector_store.store(key, str(value), embedding, metadata)
            except Exception as e:
                logger.error(f"Failed to store embedding: {e}")

        if len(self._storage) > self.max_memories:
            await self.consolidate()

        self._save()

    async def consolidate(self) -> dict:
        """Drop exact-duplicate values, then (if still over max_memories)
        the least valuable remaining entries, scored by recency and access
        count. Returns {"duplicates_removed": int, "pruned": int}."""
        duplicates_removed = await self._dedupe()
        pruned = await self._prune_to_limit()
        if duplicates_removed or pruned:
            logger.info(f"Memory consolidation: removed {duplicates_removed} duplicate(s), pruned {pruned} entr(y/ies)")
        return {"duplicates_removed": duplicates_removed, "pruned": pruned}

    async def _dedupe(self) -> int:
        seen_values: Dict[str, str] = {}  # serialized value -> key to keep
        to_remove = []

        for key, memory in sorted(self._storage.items(), key=lambda kv: kv[1].timestamp):
            serialized = json.dumps(memory.value, sort_keys=True, default=str)
            existing_key = seen_values.get(serialized)
            if existing_key is None:
                seen_values[serialized] = key
                continue

            existing = self._storage[existing_key]
            # Keep whichever duplicate has been used more; the other is
            # pure redundancy.
            if memory.access_count > existing.access_count:
                to_remove.append(existing_key)
                seen_values[serialized] = key
            else:
                to_remove.append(key)

        for key in to_remove:
            await self._remove(key)

        return len(to_remove)

    async def _prune_to_limit(self) -> int:
        overflow = len(self._storage) - self.max_memories
        if overflow <= 0:
            return 0

        def score(memory: Memory) -> tuple:
            # Lower score = pruned first: rarely accessed, long untouched.
            return (memory.access_count, memory.last_accessed)

        ranked = sorted(self._storage.values(), key=score)
        for memory in ranked[:overflow]:
            await self._remove(memory.key)

        return overflow

    async def _remove(self, key: str):
        self._storage.pop(key, None)
        if self.vector_store:
            try:
                await self.vector_store.delete(key)
            except Exception as e:
                logger.error(f"Failed to delete embedding for {key}: {e}")

    def retrieve(self, key: str) -> any:
        memory = self._storage.get(key)
        if memory:
            memory.access_count += 1
            memory.last_accessed = datetime.now()
            return memory.value
        return None

    async def search(self, query: str, strategy: str = "auto", limit: int = 10) -> List[Tuple[str, any]]:
        memories = await self.strategy_selector.retrieve(query, self._storage, strategy=strategy)
        results = []

        for memory in memories[:limit]:
            memory.access_count += 1
            memory.last_accessed = datetime.now()
            results.append((memory.key, memory.value))

        return results

    async def semantic_search(self, query: str, top_k: int = 5) -> List[Tuple[str, any, float]]:
        if not self.embedding_service or not self.vector_store:
            logger.warning("Semantic search requires embedding service and vector store")
            keyword_results = await self.search(query, strategy="keyword", limit=top_k)
            return [(k, v, 0.0) for k, v in keyword_results]

        try:
            query_embedding = await self.embedding_service.embed_text(query)
            search_results = await self.vector_store.search(query_embedding, top_k=top_k)

            results = []
            for result in search_results:
                if result.id in self._storage:
                    memory = self._storage[result.id]
                    memory.access_count += 1
                    memory.last_accessed = datetime.now()
                    results.append((result.id, memory.value, result.similarity_score))

            return results
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []

    async def batch_store(self, items: List[Dict[str, Any]]) -> int:
        count = 0
        for item in items:
            key = item.get("key")
            value = item.get("value")
            metadata = item.get("metadata")

            if key and value:
                await self.store(key, value, metadata)
                count += 1

        return count

    def get_all(self) -> dict:
        return {key: mem.value for key, mem in self._storage.items()}

    def get_recent_uploads(self, limit: int = 3) -> List[Tuple[str, str]]:
        """Most recently uploaded documents (see POST /documents/upload) as
        (filename, text) pairs, newest first."""
        uploads = [
            mem for mem in self._storage.values()
            if (mem.metadata or {}).get("source") == "upload"
        ]
        uploads.sort(key=lambda m: m.timestamp, reverse=True)
        return [
            (mem.metadata.get("filename", mem.key), mem.value)
            for mem in uploads[:limit]
        ]

    def clear(self):
        self._storage.clear()
        if self.vector_store:
            try:
                self.vector_store.clear()
            except Exception as e:
                logger.error(f"Failed to clear vector store: {e}")
        self._save()

    def get_statistics(self) -> dict:
        return {
            "total_memories": len(self._storage),
            "vector_store_size": self.vector_store.size() if self.vector_store else 0,
            "embedding_service_available": self.embedding_service is not None,
            "retrieval_strategies": self.strategy_selector.get_available_strategies(),
        }
