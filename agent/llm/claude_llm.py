import os
import inspect
import anthropic


class ClaudeLLM:
    def __init__(self, config: dict = None):
        self.config = config or {}
        api_key = self.config.get("api_key") or os.getenv("ANTHROPIC_API_KEY")
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = self.config.get("model") or "claude-3-opus-20240229"
        self.temperature = self.config.get("temperature", 0.7)
        # Some anthropic SDK versions have dropped `temperature` from
        # messages.create(); detect support instead of hardcoding it so
        # this works across SDK versions without pinning one down.
        self._supports_temperature = "temperature" in inspect.signature(
            self.client.messages.create
        ).parameters

    def _create_kwargs(self, **kwargs) -> dict:
        if self._supports_temperature:
            kwargs["temperature"] = self.temperature
        return kwargs

    async def generate(self, prompt: str) -> str:
        response = await self.client.messages.create(
            **self._create_kwargs(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        return response.content[0].text

    async def generate_with_system(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.messages.create(
            **self._create_kwargs(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        )
        return response.content[0].text
