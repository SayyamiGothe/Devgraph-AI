from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
        """
    Application configuration.

    Values are loaded from environment variables
    and the .env file.
    """

        DATABASE_URL: str

        model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings=Settings()
