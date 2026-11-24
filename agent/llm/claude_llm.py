import os
import anthropic


class ClaudeLLM:
    def __init__(self, config: dict = None):
        self.config = config or {}
        api_key = self.config.get("api_key") or os.getenv("ANTHROPIC_API_KEY")
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = self.config.get("model", "claude-3-opus-20240229")
        self.temperature = self.config.get("temperature", 0.7)

    async def generate(self, prompt: str) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
        )
        return response.content[0].text

    async def generate_with_system(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=self.temperature,
        )
        return response.content[0].text
