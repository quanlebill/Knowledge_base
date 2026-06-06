from __future__ import annotations

import threading
from typing import Any, Generic, Iterator, Protocol, TypeVar, runtime_checkable
from llama_cpp import LlamaState
from _logging import get_logger
from llama import (
    Llama3Model,
    UserMessageList,
    parse_chat_payload,
    parse_generate_payload,
)

log = get_logger("kv-cache")

T = TypeVar("T")
@runtime_checkable
class PrecachingStorage(Protocol[T]):
    def save(self, key: str, value: T) -> None: ...
    def get(self, key: str) -> T | None: ...
    def delete(self, key: str) -> None: ...
    def has(self, key: str) -> bool: ...
    def keys(self) -> list[str]: ...
    def clear(self) -> None: ...


class InMemoryStorage(Generic[T]):
    def __init__(self) -> None:
        self._store: dict[str, T] = {}

    def save(self, key: str, value: T) -> None:
        self._store[key] = value

    def get(self, key: str) -> T | None:
        return self._store.get(key)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def has(self, key: str) -> bool:
        return key in self._store

    def keys(self) -> list[str]:
        return list(self._store.keys())

    def clear(self) -> None:
        self._store.clear()


def _delta_input(
        messages: list[dict],
        offset: int,
        original_user_input: Any,
) -> Any:
    return UserMessageList(messages, offset=offset) if offset else original_user_input


class KVCacheManager:
    __slots__ = ("_client","system", "conversation", "_lock")
    def __init__(
            self,
            client: Llama3Model,
            system_storage: PrecachingStorage[LlamaState] | None = None,
            conversation_storage: PrecachingStorage[tuple[LlamaState, int]] | None = None,
    ) -> None:
        self._client = client
        self.system: PrecachingStorage[LlamaState] = system_storage or InMemoryStorage()
        self.conversation: PrecachingStorage[tuple[LlamaState, int]] = conversation_storage or InMemoryStorage()
        self._lock = threading.Lock()

    def get_client(self):
        return self._client

    def register_system_prompt(self, system_type: str, system_prompt: str) -> None:
        log.info("Computing KV snapshot for system type %r …", system_type)
        with self._lock:
            self.system.save(system_type, self._client.precaching_system_prompt(system_prompt))
        log.info("System type %r registered", system_type)

    def _save_conversation(self, user_id: str, message_count: int) -> None:
        self.conversation.save(user_id, (self._client.persist_state(), message_count))

    def _kv_start(self, user_id: str | None, system_type: str) -> tuple[LlamaState, int]:
        if user_id and self.conversation.has(user_id):
            return self.conversation.get(user_id)  # type: ignore[return-value]
        state = self.system.get(system_type)
        if state is None:
            raise KeyError(
                f"System type {system_type!r} not registered. "
                f"Call register_system() first. Available: {self.system.keys()}"
            )
        return state, 0

    def chat(
            self,
            payload: dict[str, Any],
            user_id: str | None = None,
            system_type: str = "default",
    ) -> dict[str, Any]:
        kwargs = parse_chat_payload(payload)
        messages = kwargs["user_input"].messages
        formatter = kwargs["formatter"]
        gen_kwargs = kwargs["gen_kwargs"]
        max_tok = kwargs["max_tokens"]

        with self._lock:
            state, offset = self._kv_start(
                user_id=user_id,
                system_type=system_type)
            self._client.reload_state(state)

            user_input = _delta_input(
                messages=messages,
                offset=offset,
                original_user_input=kwargs["user_input"])
            input_tokens = self._client.prefill(user_input)

            result = self._client.decode_reply(input_tokens, formatter, gen_kwargs, max_tok)
            if user_id:
                self._client.eval_assistant_reply(result["message"]["content"])
                self._save_conversation(user_id, len(messages) + 1)

            return result

    def chat_stream(
            self,
            payload: dict[str, Any],
            user_id: str | None = None,
            system_type: str = "default",
    ) -> Iterator[dict[str, Any]]:

        kwargs = parse_chat_payload(payload)
        messages = kwargs["user_input"].messages
        formatter = kwargs["formatter"]
        gen_kwargs = kwargs["gen_kwargs"]
        max_tokens = kwargs["max_tokens"]

        with self._lock:
            state, offset = self._kv_start(
                user_id=user_id,
                system_type=system_type)
            self._client.reload_state(state)

            user_input = _delta_input(
                messages= messages,
                offset= offset,
                original_user_input= kwargs["user_input"])

            self._client.prefill(user_input)

            reply_parts: list[str] = []
            for chunk in self._client.stream_decode_reply(
                    formatter = formatter,
                    gen_kwargs = gen_kwargs,
                    max_tokens = max_tokens):
                reply_parts.append(chunk["message"]["content"])
                yield chunk

            if user_id:
                self._client.eval_assistant_reply("".join(reply_parts))
                self._save_conversation(user_id, len(messages) + 1)

    def completion(
            self,
            payload: dict[str, Any],
            system_type: str = "default",
    ) -> dict[str, Any]:
        kwargs = parse_generate_payload(payload)
        with self._lock:
            state, _ = self._kv_start(None, system_type)
            self._client.reload_state(state)
            return self._client.response(**kwargs)

    def completion_stream(
            self,
            payload: dict[str, Any],
            system_type: str = "default",
    ) -> Iterator[dict[str, Any]]:
        kwargs = parse_generate_payload(payload)
        with self._lock:
            state, _ = self._kv_start(None, system_type)
            self._client.reload_state(state)
            yield from self._client.stream_response(**kwargs)
