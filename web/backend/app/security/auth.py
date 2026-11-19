from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping
from uuid import UUID

import jwt
from jwt.algorithms import has_crypto
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError


class AuthConfigurationError(RuntimeError):
    """Raised when server-side token verification is not configured safely."""


class TokenValidationError(ValueError):
    """Raised when a bearer token is not a valid Supabase user access token."""


@dataclass(frozen=True, slots=True)
class AuthPrincipal:
    user_id: str
    role: str
    claims: Mapping[str, Any]


class SupabaseTokenVerifier:
    """Verify Supabase access JWTs locally using JWKS or an explicit legacy secret."""

    ASYMMETRIC_ALGORITHMS = frozenset({"RS256", "ES256"})
    LEGACY_ALGORITHM = "HS256"

    def __init__(
        self,
        *,
        issuer: str,
        audience: str,
        jwks_url: str,
        legacy_jwt_secret: str | None = None,
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._audience = audience
        self._legacy_jwt_secret = legacy_jwt_secret
        self._jwks_client = PyJWKClient(
            jwks_url,
            cache_keys=True,
            cache_jwk_set=True,
            lifespan=300,
            timeout=5,
        )

    def verify(self, token: str) -> AuthPrincipal:
        if not token:
            raise TokenValidationError("Bearer token is empty.")

        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError as exc:
            raise TokenValidationError("Malformed access token.") from exc

        algorithm = header.get("alg")
        if algorithm == self.LEGACY_ALGORITHM:
            if not self._legacy_jwt_secret:
                raise AuthConfigurationError(
                    "SUPABASE_JWT_SECRET is required to verify legacy HS256 access tokens."
                )
            key: Any = self._legacy_jwt_secret
            algorithms = [self.LEGACY_ALGORITHM]
        elif algorithm in self.ASYMMETRIC_ALGORITHMS:
            if not has_crypto:
                raise AuthConfigurationError(
                    "The cryptography package is required to verify asymmetric access tokens."
                )
            try:
                key = self._jwks_client.get_signing_key_from_jwt(token).key
            except (PyJWKClientError, InvalidTokenError) as exc:
                raise TokenValidationError("Unable to resolve the access token signing key.") from exc
            algorithms = [str(algorithm)]
        else:
            raise TokenValidationError("Access token uses an unsupported signing algorithm.")

        try:
            claims = jwt.decode(
                token,
                key=key,
                algorithms=algorithms,
                audience=self._audience,
                issuer=self._issuer,
                options={
                    "require": ["aud", "exp", "iat", "sub", "role"],
                    "verify_signature": True,
                    "verify_aud": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_iss": True,
                    "verify_nbf": True,
                },
            )
        except InvalidTokenError as exc:
            raise TokenValidationError("Invalid or expired access token.") from exc

        subject = claims.get("sub")
        role = claims.get("role")
        if not isinstance(subject, str) or not subject:
            raise TokenValidationError("Access token has no user subject.")
        try:
            UUID(subject)
        except ValueError as exc:
            raise TokenValidationError("Access token subject is not a valid user identifier.") from exc
        if role != "authenticated":
            raise TokenValidationError("Access token is not a user session token.")

        return AuthPrincipal(user_id=subject, role=role, claims=claims)
