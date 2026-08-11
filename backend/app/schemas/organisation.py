from pydantic import BaseModel


class OrganisationUpdateRequest(BaseModel):
    name: str