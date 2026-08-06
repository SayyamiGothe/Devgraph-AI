from passlib.context import CryptContext

# Password hashing configuration
pwd_context = CryptContext(schemas=["bycrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Convert a plain-text password into a secure hash.
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Compare a plain password with its stored hash.
    """

    return pwd_context.verify(
        plain_password,
        hashed_password,
    )