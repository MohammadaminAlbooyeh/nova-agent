import os
from groq import AsyncGroq


class GroqLLM:
    def __init__(self, config: dict = None):
        self.config = config or {}
        api_key = self.config.get("api_key") or os.getenv("GROQ_API_KEY")
        self.client = AsyncGroq(api_key=api_key)
        # mixtral-8x7b-32768 was retired by Groq; openai/gpt-oss-120b is
        # their current recommended default (see console.groq.com/docs/models).
        # `or` (not .get(key, default)) because callers pass an explicit
        # "model": None when the user left the field blank, and dict.get's
        # default only applies when the key is missing entirely.
        self.model = self.config.get("model") or "openai/gpt-oss-120b"
        self.temperature = self.config.get("temperature", 0.7)

    async def generate(self, prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
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
        )
        return response.choices[0].message.content
