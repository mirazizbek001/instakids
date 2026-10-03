from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import access_status, google_login, public_config, block_user, call_signals, change_password, csrf_token, delete_account, session_status, delete_chat, delete_user, home, login, login_activity, logout, moderation_queue, moderation_review, platform_settings, presence_status, register, report_reel, social_fast_action, social_state, social_updates, users

router = DefaultRouter()
# router.register("tovar", basename="tovar")

urlpatterns = [path("", home, name="home"),
              path("csrf/", csrf_token, name="csrf-token"),
              path("session/", session_status, name="session-status"),
              path("access/", access_status, name="access-status"),
              path("settings/", platform_settings, name="platform-settings"),
              path("register/", register, name="register"),
              path("login/", login, name="login"),
              path("config/", public_config, name="public-config"),
              path("google/", google_login, name="google-login"),
              path("login-activity/", login_activity, name="login-activity"),
              path("moderation/", moderation_queue, name="moderation-queue"),
              path("moderation/<int:report_id>/", moderation_review, name="moderation-review"),
              path("reels/<str:reel_id>/report/", report_reel, name="report-reel"),
              path("users/<str:username>/block/", block_user, name="block-user"),
              path("chats/<str:username>/", delete_chat, name="delete-chat"),
              path("calls/signals/", call_signals, name="call-signals"),
              path("presence/", presence_status, name="presence-status"),
              path("users/", users, name="users"),
              path("change-password/", change_password, name="change-password"),
              path("delete-account/", delete_account, name="delete-account"),
              path("users/<str:username>/delete/", delete_user, name="delete-user"),
              path("logout/", logout, name="logout"),
              path("social/", social_state, name="social-state"),
              path("social/fast/", social_fast_action, name="social-fast-action"),
              path("social/updates/", social_updates, name="social-updates"),

               ]
urlpatterns += router.urls
