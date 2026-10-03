from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve as media_serve

BUILD = 'split-1'


def health(request):
    return JsonResponse({
        'status': 'ok',
        'build': BUILD,
        'google_configured': bool(settings.GOOGLE_CLIENT_ID),
        'database': settings.DATABASES['default']['ENGINE'].rsplit('.', 1)[-1],
        'data_persistent': settings.DATA_PERSISTENT,
    })


urlpatterns = [
    path('', health, name='root-health'),
    path('health/', health, name='health'),
    path('django-admin/', admin.site.urls),
    path('plat/', include('plat.urls')),
    # Yuklangan fayllar (Volume ichidagi media papka)
    re_path(r'^media/(?P<path>.*)$', media_serve, {'document_root': settings.MEDIA_ROOT}, name='media'),
]
