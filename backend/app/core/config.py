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
        NEO4J_URI: str 
        NEO4J_USER: str 
        NEO4J_PASSWORD: str 
        NEO4J_DATABASE: str

        MAX_ZIP_SIZE_MB: int
        MAX_REPO_FILES: int 
        MODE: str = "development"

        model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings=Settings()
