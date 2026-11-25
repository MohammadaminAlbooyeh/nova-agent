import os
from groq import AsyncGroq


class GroqLLM:
    def __init__(self, config: dict = None):
        self.config = config or {}
        api_key = self.config.get("api_key") or os.getenv("GROQ_API_KEY")
        self.client = AsyncGroq(api_key=api_key)
        # mixtral-8x7b-32768 and the llama-3.x chat models were retired by
        # Groq; as of writing, the openai/gpt-oss family is the only
        # general chat model this account's plan exposes. gpt-oss has
        # native tool-calling built in and will sometimes emit a raw
        # function-call response instead of following our plain-text ReAct
        # prompt format, even though we never pass a `tools` param - Groq
        # then rejects it with "Tool choice is none, but model called a
        # tool" (400). disable_tool_validation below stops Groq enforcing
        # that check so the raw response comes through instead of a 400;
        # our own ReAct parser (_parse_action/_is_final) then just treats
        # whatever text it contains as the model's answer.
        # `or` (not .get(key, default)) because callers pass an explicit
        # "model": None when the user left the field blank, and dict.get's
        # default only applies when the key is missing entirely.
        self.model = self.config.get("model") or "openai/gpt-oss-20b"
        self.temperature = self.config.get("temperature", 0.7)

    async def generate(self, prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
            tool_choice="none",
            disable_tool_validation=True,
        )
        return response.choices[0].message.content

    async def generate_with_system(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self.temperature,
            tool_choice="none",
            disable_tool_validation=True,
        )
        return response.choices[0].message.content
