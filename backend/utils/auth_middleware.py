from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

# Bearer token extractor
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    FastAPI dependency to extract and verify the Firebase ID token
    from the Authorization Header.
    """
    token = credentials.credentials
    try:
        # Verify the Firebase ID token
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

class RoleChecker:
    """
    FastAPI dependency to enforce role-based access control (RBAC).
    Checks the custom claims of the verified Firebase ID Token.
    """
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Security(get_current_user)):
        # Firebase custom claims contain the user's role
        # If the user is the default admin, or has the custom role claim
        user_role = current_user.get("role")
        
        # Check if the user is a hardcoded/default admin or matches the roles
        is_admin_user = current_user.get("email") == "admin@nazareth.com" or current_user.get("uid") == "admin-uid"
        
        if is_admin_user:
            return current_user
            
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role in: {self.allowed_roles}",
            )
        return current_user

# Predefined role dependencies
require_admin = RoleChecker(["admin"])
require_student = RoleChecker(["student", "admin"])
require_parent = RoleChecker(["parent", "admin"])
