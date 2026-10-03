from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('plat', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PlatformSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('open_time', models.TimeField(default='08:00')),
                ('close_time', models.TimeField(default='22:00')),
                ('usage_limit_minutes', models.PositiveIntegerField(default=30)),
                ('cooldown_minutes', models.PositiveIntegerField(default=10)),
                ('enabled', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='UsageState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('used_seconds', models.PositiveIntegerField(default=0)),
                ('last_ping_at', models.DateTimeField(blank=True, null=True)),
                ('blocked_until', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='platform_usage', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
