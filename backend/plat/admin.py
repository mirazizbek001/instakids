from django.contrib import admin
from .models import PlatformSettings, SocialState, UsageState


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ('open_time', 'close_time', 'usage_limit_minutes', 'cooldown_minutes', 'enabled', 'updated_at')


@admin.register(UsageState)
class UsageStateAdmin(admin.ModelAdmin):
    list_display = ('user', 'used_seconds', 'blocked_until', 'last_ping_at', 'updated_at')
    search_fields = ('user__username',)


@admin.register(SocialState)
class SocialStateAdmin(admin.ModelAdmin):
    readonly_fields = ('updated_at',)
