import os
from cryptography.fernet import Fernet
from agent.utils.logger import get_logger

logger = get_logger(__name__)


class EncryptionUtil:
    def __init__(self, key: str = None):
        self.key = key or os.getenv("ENCRYPTION_KEY")

        if not self.key:
            # A random per-process key would silently make every previously
            # encrypted token undecryptable after a restart or on another
            # instance, so refuse to start instead of generating one.
            raise ValueError(
                "ENCRYPTION_KEY env var is not set. Generate one with "
                "EncryptionUtil.generate_key() and set it before starting the service."
            )

        if isinstance(self.key, str):
            self.key = self.key.encode()
        self.cipher = Fernet(self.key)

    def encrypt(self, data: str) -> str:
        if isinstance(data, str):
            data = data.encode()
        encrypted = self.cipher.encrypt(data)
        return encrypted.decode()

    def decrypt(self, encrypted_data: str) -> str:
        if isinstance(encrypted_data, str):
            encrypted_data = encrypted_data.encode()
        decrypted = self.cipher.decrypt(encrypted_data)
        return decrypted.decode()

    @staticmethod
    def generate_key() -> str:
        return Fernet.generate_key().decode()
