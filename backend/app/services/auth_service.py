from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.user_repository import UserRepository
from app.core.security import hash_password
from backend.app.models.user import User


class AuthService:

    def __init__(self,db:Session):

        self.user_repository=UserRepository(db)

    def register(self,email:str,password:str,organisation_id:int):

          # Check whether email already exists
        existing_user=self.user_repository.get_by_emil(email)

        if existing_user:
            raise HTTPException(status_code=400,detail="email alredy exist")


        password_hash = hash_password(password)

         # Create User object so that it will add to the user table
         

        user = User(
            email=email,
            password_hash=password_hash,
            role="USER",
            organization_id=organisation_id,
        )


    
        # Save user
   

        return self.user_repository.create(user)