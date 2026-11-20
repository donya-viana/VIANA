
import os
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash

from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Query
)
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from supabase import create_client


# ================= تنظیمات =================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not all([
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET_KEY
]):
    raise ValueError("Missing settings in .env file")

# کلید خصوصی فقط در سرور پایتون استفاده می‌شود
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)

password_hash = PasswordHash.recommended()
security = HTTPBearer()

app = FastAPI(title="VIANA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= مدل اطلاعات =================

class RegisterData(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value):
        value = value.strip()

        if not re.fullmatch(r"[a-zA-Z0-9_.]+", value):
            raise ValueError(
                "Username can contain only English letters, numbers, _ and ."
            )

        return value


class LoginData(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=1, max_length=128)


class SendMessageData(BaseModel):
    recipient_id: UUID
    content: str = Field(min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Message cannot be empty")

        return value


# ================= ساخت توکن =================

def create_access_token(user_id, username):
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm="HS256"
    )


# ================= بررسی توکن =================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=["HS256"]
        )

        return {
            "id": payload["sub"],
            "username": payload["username"]
        }

    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


# ================= صفحه اصلی API =================

@app.get("/")
def home():
    return {
        "message": "VIANA Server is running!"
    }


# ================= آزمایش اتصال دیتابیس =================

@app.get("/test-supabase")
def test_supabase():
    try:
        result = (
            supabase.table("messages")
            .select("id")
            .limit(1)
            .execute()
        )

        return {
            "status": "connected",
            "message": "Supabase connection successful!",
            "rows_found": len(result.data)
        }

    except Exception as error:
        print("Supabase test error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Database connection failed"
        )


# ================= ثبت نام =================

@app.post("/auth/register")
def register(data: RegisterData):
    username = data.username

    try:
        hashed_password = password_hash.hash(data.password)

        result = supabase.table("chat_users").insert({
            "username": username,
            "password_hash": hashed_password
        }).execute()

        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Registration failed"
            )

        user = result.data[0]

        return {
            "message": "Registration successful",
            "user": {
                "id": user["id"],
                "username": user["username"]
            }
        }

    except HTTPException:
        raise

    except Exception as error:
        error_text = str(error).lower()

        if (
            "duplicate" in error_text
            or "unique" in error_text
            or "23505" in error_text
        ):
            raise HTTPException(
                status_code=409,
                detail="This username is already taken"
            )

        print("Registration error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Registration failed"
        )


# ================= ورود =================

@app.post("/auth/login")
def login(data: LoginData):
    username = data.username.strip()

    try:
        result = (
            supabase.table("chat_users")
            .select("id, username, password_hash")
            .ilike("username", username)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password"
            )

        user = result.data[0]

        if not password_hash.verify(
            data.password,
            user["password_hash"]
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password"
            )

        token = create_access_token(
            user["id"],
            user["username"]
        )

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"]
            }
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Login error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Login failed"
        )


# ================= اطلاعات کاربر واردشده =================

@app.get("/auth/me")
def get_my_account(
    current_user: dict = Depends(get_current_user)
):
    return {
        "message": "Authenticated successfully",
        "user": current_user
    }


# ================= جستجوی کاربران =================

@app.get("/users/search")
def search_users(
    q: str = Query(min_length=2, max_length=30),
    current_user: dict = Depends(get_current_user)
):
    search_text = q.strip()

    if not search_text:
        raise HTTPException(
            status_code=400,
            detail="Search text is required"
        )

    try:
        result = (
            supabase.table("chat_users")
            .select("id, username")
            .ilike("username", f"%{search_text}%")
            .neq("id", current_user["id"])
            .limit(20)
            .execute()
        )

        return {
            "users": result.data
        }

    except Exception as error:
        print("User search error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="User search failed"
        )


# ================= ارسال پیام خصوصی =================

@app.post("/messages/send")
def send_message(
    data: SendMessageData,
    current_user: dict = Depends(get_current_user)
):
    sender_id = current_user["id"]
    recipient_id = str(data.recipient_id)

    if sender_id == recipient_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a message to yourself"
        )

    try:
        recipient = (
            supabase.table("chat_users")
            .select("id, username")
            .eq("id", recipient_id)
            .limit(1)
            .execute()
        )

        if not recipient.data:
            raise HTTPException(
                status_code=404,
                detail="Recipient not found"
            )

        result = supabase.table("messages").insert({
            "sender_id": sender_id,
            "recipient_id": recipient_id,
            "content": data.content
        }).execute()

        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Message could not be sent"
            )

        return {
            "message": "Message sent successfully",
            "data": result.data[0]
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Send message error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Message sending failed"
        )


# ================= دریافت تاریخچه گفتگوی خصوصی =================

@app.get("/messages/{other_user_id}")
def get_private_messages(
    other_user_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    my_id = current_user["id"]
    other_id = str(other_user_id)

    if my_id == other_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation"
        )

    try:
        other_user = (
            supabase.table("chat_users")
            .select("id, username")
            .eq("id", other_id)
            .limit(1)
            .execute()
        )

        if not other_user.data:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        sent = (
            supabase.table("messages")
            .select("id, sender_id, recipient_id, content, created_at")
            .eq("sender_id", my_id)
            .eq("recipient_id", other_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        received = (
            supabase.table("messages")
            .select("id, sender_id, recipient_id, content, created_at")
            .eq("sender_id", other_id)
            .eq("recipient_id", my_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        messages = sent.data + received.data

        messages.sort(
            key=lambda item: item.get("created_at") or ""
        )

        messages = messages[-limit:]

        return {
            "conversation_with": other_user.data[0],
            "messages": messages
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Get messages error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Could not load conversation"
        )


# ================= نمایش صفحات سایت VIANA =================
# این بخش باید آخرین قسمت فایل باشد.

app.mount(
    "/",
    StaticFiles(directory=BASE_DIR, html=True),
    name="static"
)
