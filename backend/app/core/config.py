from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
        """
    Application configuration.

    Values are loaded from environment variables
    and the .env file.
    """

        DATABASE_URL: str
        JWT_SECRET_KEY:str
        JWT_ALGORITHM:str
        ACCESS_TOKEN_EXPIRE_MINUTES:int
        REFRESH_TOKEN_EXPIRE_DAYS:int
        GROQ_API_KEY: str
        MODEL_NAME: str
        FRONTEND_URL: str

        MODE: str = "development"

        model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings=Settings()
