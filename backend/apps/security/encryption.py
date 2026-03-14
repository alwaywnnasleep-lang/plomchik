import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.db import models


def get_encryption_key():
    key_b64 = settings.ENCRYPTION_KEY
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        key = key.ljust(32, b'\0')[:32]
    return key


class AES256Cipher:
    def __init__(self):
        self.key = get_encryption_key()
        self.aesgcm = AESGCM(self.key)

    def encrypt(self, plaintext: str) -> str:
        nonce = os.urandom(12)
        ciphertext = self.aesgcm.encrypt(
            nonce, plaintext.encode('utf-8'), None,
        )
        return base64.b64encode(nonce + ciphertext).decode('utf-8')

    def decrypt(self, encrypted: str) -> str:
        data = base64.b64decode(encrypted)
        nonce = data[:12]
        ciphertext = data[12:]
        plaintext = self.aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode('utf-8')


cipher = AES256Cipher()


class EncryptedTextField(models.TextField):
    def get_prep_value(self, value):
        if value is None:
            return value
        return cipher.encrypt(value)

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        try:
            return cipher.decrypt(value)
        except Exception:
            return value

    def value_from_object(self, obj):
        val = super().value_from_object(obj)
        return val


class EncryptedCharField(models.CharField):
    def get_prep_value(self, value):
        if value is None:
            return value
        encrypted = cipher.encrypt(value)
        return encrypted

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        try:
            return cipher.decrypt(value)
        except Exception:
            return value