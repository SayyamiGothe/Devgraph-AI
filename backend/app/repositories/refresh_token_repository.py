from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, refresh_token: RefreshToken):
        self.db.add(refresh_token)
        self.db.commit()
        self.db.refresh(refresh_token)

        return refresh_token

    def get_by_token(self, token: str):
        return (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token == token)
            .first()
        )

    def delete(self, refresh_token: RefreshToken):
        self.db.delete(refresh_token)
        self.db.commit()

    def delete_expired(self):
        self.db.query(RefreshToken).filter(
            RefreshToken.expires_at < datetime.now(timezone.utc)
        ).delete()

        self.db.commit()

    def revoke(self, refresh_token: RefreshToken):

        refresh_token.revoked = True

        self.db.commit()
        self.db.refresh(refresh_token)

        return refresh_token