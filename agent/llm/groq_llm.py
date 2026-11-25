import json
import os
import groq
from groq import AsyncGroq


class GroqLLM:
    def __init__(self, config: dict = None):
        self.config = config or {}
        api_key = self.config.get("api_key") or os.getenv("GROQ_API_KEY")
        self.client = AsyncGroq(api_key=api_key)
        # mixtral-8x7b-32768 and the llama-3.x chat models were retired by
        # Groq; as of writing, the openai/gpt-oss family is the only
        # general chat model this account's plan exposes.
        # `or` (not .get(key, default)) because callers pass an explicit
        # "model": None when the user left the field blank, and dict.get's
        # default only applies when the key is missing entirely.
        self.model = self.config.get("model") or "openai/gpt-oss-20b"
        self.temperature = self.config.get("temperature", 0.7)

    async def generate(self, prompt: str) -> str:
        return await self._create([{"role": "user", "content": prompt}])

    async def generate_with_system(self, system_prompt: str, user_prompt: str) -> str:
        return await self._create([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ])

    async def _create(self, messages: list[dict]) -> str:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
            )
            return response.choices[0].message.content
        except groq.BadRequestError as e:
            # gpt-oss has native tool-calling built in and will sometimes
            # emit a raw function-call response instead of following our
            # plain-text ReAct prompt format, even though we never pass a
            # `tools` param - Groq then rejects the whole response with
            # "Tool choice is none, but model called a tool" (400), but the
            # tool call it attempted is still right there in the error body
            # (`failed_generation`). Recover it into the same
            # "Action: ...\nAction Input: ..." shape our own ReAct parser
            # already expects from any other model, instead of surfacing a
            # hard failure for behavior the model volunteered unprompted.
            recovered = self._recover_tool_call(e)
            if recovered:
                return recovered
            raise

    def _recover_tool_call(self, error: "groq.BadRequestError") -> str | None:
        body = getattr(error, "body", None) or {}
        error_payload = body.get("error", {}) if isinstance(body, dict) else {}
        failed_generation = error_payload.get("failed_generation") if isinstance(error_payload, dict) else None
        if not failed_generation:
            return None
        try:
            call = json.loads(failed_generation)
            name = call["name"]
            arguments = call.get("arguments", {})
        except (json.JSONDecodeError, KeyError, TypeError):
            return None
        return f"Action: {name}\nAction Input: {json.dumps(arguments)}"
