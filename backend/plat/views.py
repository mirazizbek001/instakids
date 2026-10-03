import json
import random
import uuid
from django.db import transaction
import re
import urllib.parse
import urllib.request
from django.conf import settings as django_settings
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout, update_session_auth_hash
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import CallSignal, LoginActivity, ModerationReport, SocialState, PlatformSettings, UsageState, UserBlock, UserPresence, UserRestriction
from .safety import get_platform_settings, is_service_open, settings_payload, suspected_adult_text, validate_media_item, validate_text


def _client_ip(request):
	forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
	return forwarded or request.META.get('REMOTE_ADDR')


def _body(request):
	"""Kelgan JSON obyekt bo'lmasa ham (ro'yxat, matn...) 500 bermasligi uchun."""
	data = request.data
	return data if isinstance(data, dict) else {}


def _str(data, key, default=''):
	value = data.get(key, default)
	return value.strip() if isinstance(value, str) else default


def _name(value):
	return value if isinstance(value, str) else ''


def _device_name(user_agent):
	ua = (user_agent or '').lower()
	if 'android' in ua: return 'Android'
	if 'iphone' in ua or 'ipad' in ua: return 'iPhone/iPad'
	if 'windows' in ua: return 'Windows'
	if 'mac os' in ua: return 'macOS'
	if 'linux' in ua: return 'Linux'
	return 'Noma\'lum qurilma'


def _record_login(request, user):
	user_agent = request.META.get('HTTP_USER_AGENT', '')
	LoginActivity.objects.create(
		user=user,
		username=user.username,
		ip_address=_client_ip(request),
		device=_device_name(user_agent),
		user_agent=user_agent,
	)


def _merge_user_comments(existing, incoming, username):
	existing_by_id = {
		comment.get('id'): comment for comment in existing if comment.get('id')
	}
	comments = {
		comment_id: comment
		for comment_id, comment in existing_by_id.items()
		if comment.get('userId') != username
	}
	for comment in incoming:
		comment_id = comment.get('id')
		old_comment = existing_by_id.get(comment_id)
		if (
			comment_id
			and comment.get('userId') == username
			and (old_comment is None or old_comment.get('userId') == username)
		):
			comments[comment_id] = comment
	return list(comments.values())


def _merge_owned_media(existing, incoming, username, allow_interactions=False):
	incoming_by_id = {item.get('id'): item for item in incoming if item.get('id')}
	merged = []
	for item in existing:
		item_id = item.get('id')
		if item.get('userId') == username:
			updated = incoming_by_id.pop(item_id, None)
			if updated:
				if allow_interactions:
					likes = set(item.get('likes', [])) - {username}
					if username in updated.get('likes', []):
						likes.add(username)
					updated['likes'] = list(likes)
					updated['comments'] = _merge_user_comments(
						item.get('comments', []), updated.get('comments', []), username,
					)
				merged.append(updated)
			continue

		updated = incoming_by_id.pop(item_id, None)
		if allow_interactions and updated:
			old_likes = set(item.get('likes', []))
			new_likes = set(updated.get('likes', []))
			old_likes.discard(username)
			if username in new_likes:
				old_likes.add(username)
			item['likes'] = list(old_likes)
			item['comments'] = _merge_user_comments(
				item.get('comments', []), updated.get('comments', []), username,
			)
		merged.append(item)

	merged.extend(item for item in incoming_by_id.values() if item.get('userId') == username)
	return merged


def _is_admin_user(user):
	return bool(user and user.is_authenticated and (user.username.lower() == 'admin' or user.is_staff or user.is_superuser))


def _active_restriction(user):
	if not user or not user.is_authenticated or _is_admin_user(user):
		return None
	return UserRestriction.objects.filter(user=user, restricted_until__gt=timezone.now()).first()


def _users_block_each_other(first, second):
	return UserBlock.objects.filter(
		Q(blocker__username=first, blocked__username=second) |
		Q(blocker__username=second, blocked__username=first)
	).exists()


def _queue_moderation(user, content_type, item, reason):
	content_id = str(item.get('id') or timezone.now().timestamp())
	item['id'] = content_id
	report = ModerationReport.objects.filter(
		username=user.username, content_type=content_type, content_id=content_id, status=ModerationReport.PENDING,
	).first()
	if report:
		report.content = item
		report.reason = reason
		report.save(update_fields=['content', 'reason'])
	else:
		ModerationReport.objects.create(
			user=user, username=user.username, content_type=content_type,
			content_id=content_id, content=item, reason=reason,
		)
	return {'type': content_type, 'id': content_id}


def _usage_status(user, touch=True):
	if not user or not user.is_authenticated or _is_admin_user(user):
		return {'allowed': True, 'cooldown': False, 'usedSeconds': 0, 'remainingSeconds': 0}

	settings = get_platform_settings()
	now = timezone.now()
	usage, _ = UsageState.objects.get_or_create(user=user)

	if usage.blocked_until and usage.blocked_until > now:
		remaining = max(0, int((usage.blocked_until - now).total_seconds()))
		return {'allowed': False, 'cooldown': True, 'usedSeconds': 0, 'remainingSeconds': remaining}

	if usage.blocked_until and usage.blocked_until <= now:
		usage.blocked_until = None
		usage.used_seconds = 0

	if touch and usage.last_ping_at:
		delta = max(0, min(90, int((now - usage.last_ping_at).total_seconds())))
		usage.used_seconds += delta

	usage.last_ping_at = now
	limit = settings.usage_limit_minutes * 60
	if settings.usage_limit_minutes > 0 and usage.used_seconds >= limit:
		usage.blocked_until = now + timedelta(minutes=settings.cooldown_minutes)
		usage.used_seconds = 0
		usage.save(update_fields=['used_seconds', 'last_ping_at', 'blocked_until', 'updated_at'])
		return {'allowed': False, 'cooldown': True, 'usedSeconds': 0, 'remainingSeconds': settings.cooldown_minutes * 60}

	usage.save(update_fields=['used_seconds', 'last_ping_at', 'blocked_until', 'updated_at'])
	return {
		'allowed': True,
		'cooldown': False,
		'usedSeconds': usage.used_seconds,
		'remainingSeconds': max(0, limit - usage.used_seconds) if settings.usage_limit_minutes > 0 else 0,
	}


def home(request):
	return JsonResponse({'message': 'Backend ishlayapti', 'serviceOpen': is_service_open(), **settings_payload()})


@api_view(['GET'])
def access_status(request):
	settings = get_platform_settings()
	open_now = is_service_open()
	usage = _usage_status(request.user, touch=open_now)
	admin = _is_admin_user(request.user)
	restriction = _active_restriction(request.user)
	allowed = admin or (open_now and usage['allowed'])
	reason = 'open'
	if not open_now and not admin:
		reason = 'hours'
	elif not usage['allowed'] and not admin:
		reason = 'cooldown'
	response = Response({
		'open': allowed,
		'reason': reason,
		'cooldownSeconds': usage['remainingSeconds'] if reason == 'cooldown' else 0,
		'usageSeconds': usage['usedSeconds'],
		'usageRemainingSeconds': usage['remainingSeconds'],
		'restriction': {
			'active': bool(restriction),
			'until': timezone.localtime(restriction.restricted_until).isoformat() if restriction else None,
			'remainingSeconds': max(0, int((restriction.restricted_until - timezone.now()).total_seconds())) if restriction else 0,
		},
		**settings_payload(),
	})
	response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
	return response


def _closed_response(reason='hours'):
	settings = get_platform_settings()
	if reason == 'cooldown':
		message = f"Vaqtinchalik tanaffus. Yana {settings.cooldown_minutes} daqiqadan keyin kirishingiz mumkin."
	else:
		message = f"Platforma hozir yopiq. Ish vaqti: {settings.open_time.strftime('%H:%M')}–{settings.close_time.strftime('%H:%M')} (Toshkent vaqti)."
	return Response({'error': message, 'reason': reason, **settings_payload()}, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET', 'PUT'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def platform_settings(request):
	if not _is_admin_user(request.user):
		return Response({'error': 'Faqat admin uchun.'}, status=status.HTTP_403_FORBIDDEN)
	settings = get_platform_settings()
	if request.method == 'PUT':
		data = request.data if isinstance(request.data, dict) else {}
		try:
			if 'start' in data: settings.open_time = datetime.strptime(str(data['start']), '%H:%M').time()
			if 'end' in data: settings.close_time = datetime.strptime(str(data['end']), '%H:%M').time()
			if 'usageLimitMinutes' in data: settings.usage_limit_minutes = max(1, min(1440, int(data['usageLimitMinutes'])))
			if 'cooldownMinutes' in data: settings.cooldown_minutes = max(1, min(1440, int(data['cooldownMinutes'])))
			if 'enabled' in data: settings.enabled = bool(data['enabled'])
		except (ValueError, TypeError):
			return Response({'error': 'Vaqt yoki daqiqa qiymati noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
		settings.save()
	response = Response(settings_payload())
	response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
	return response

@ensure_csrf_cookie
def csrf_token(request):
	response = JsonResponse({'csrfToken': get_token(request)})
	response['Cache-Control'] = 'no-store'
	return response


@api_view(['GET'])
def session_status(request):
	user = request.user
	if not user or not user.is_authenticated:
		return Response({'authenticated': False})
	return Response({
		'authenticated': True,
		'id': user.id,
		'username': user.username,
		'email': user.email,
		'name': user.first_name,
		'isAdmin': _is_admin_user(user),
		'csrfToken': get_token(request._request),
	})


@api_view(['POST'])
def register(request):
	data = _body(request)
	username = _str(data, 'username').lower()
	if not is_service_open():
		return _closed_response('hours')
	email = _str(data, 'email').lower()
	name = _str(data, 'name')
	password = data.get('password', '')
	if not isinstance(password, str):
		password = ''

	if len(username) < 3:
		return Response({'error': 'Username kamida 3 ta belgi'}, status=status.HTTP_400_BAD_REQUEST)
	if not email or '@' not in email or '.' not in email.rsplit('@', 1)[-1]:
		return Response({'error': 'To‘g‘ri email manzil kiriting'}, status=status.HTTP_400_BAD_REQUEST)
	if not name:
		return Response({'error': 'Ismingizni kiriting'}, status=status.HTTP_400_BAD_REQUEST)
	if len(password) < 4:
		return Response({'error': 'Parol kamida 4 ta belgi'}, status=status.HTTP_400_BAD_REQUEST)
	if User.objects.filter(email__iexact=email).exists():
		return Response({'error': 'Bu email allaqachon ro‘yxatdan o‘tgan'}, status=status.HTTP_409_CONFLICT)
	existing_user = User.objects.filter(username=username).first()
	if existing_user:
		if existing_user.check_password(password):
			if not _is_admin_user(existing_user) and not _usage_status(existing_user, touch=False)['allowed']:
				return _closed_response('cooldown')
			auth_login(request._request, existing_user)
			_record_login(request._request, existing_user)
			return Response({'id': existing_user.id, 'username': existing_user.username, 'email': existing_user.email, 'name': existing_user.first_name, 'isAdmin': _is_admin_user(existing_user), 'csrfToken': get_token(request._request)})
		return Response({'error': 'Bu username band'}, status=status.HTTP_409_CONFLICT)
	if username == 'admin':
		return Response({'error': 'Admin akkauntini faqat server administratori yaratishi mumkin.'}, status=status.HTTP_403_FORBIDDEN)

	user = User.objects.create_user(username=username, email=email, first_name=name[:150], password=password)
	UsageState.objects.get_or_create(user=user)
	auth_login(request._request, user)
	_record_login(request._request, user)
	return Response({'id': user.id, 'username': user.username, 'email': user.email, 'name': user.first_name, 'isAdmin': _is_admin_user(user), 'csrfToken': get_token(request._request)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login(request):
	data = _body(request)
	username = _str(data, 'username').lower()
	password = data.get('password', '')
	if not isinstance(password, str):
		password = ''
	user = authenticate(request._request, username=username, password=password)
	if not user:
		return Response({'ok': False, 'error': 'Username yoki parol noto‘g‘ri'}, status=status.HTTP_401_UNAUTHORIZED)
	admin = _is_admin_user(user)
	if not is_service_open() and not admin:
		return _closed_response('hours')
	if not admin:
		usage = _usage_status(user, touch=False)
		if not usage['allowed']:
			return _closed_response('cooldown')
	auth_login(request._request, user)
	_record_login(request._request, user)
	return Response({'id': user.id, 'username': user.username, 'email': user.email, 'name': user.first_name, 'isAdmin': admin, 'csrfToken': get_token(request._request)})


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def login_activity(request):
	if not _is_admin_user(request.user):
		return Response({'error': 'Faqat admin uchun.'}, status=status.HTTP_403_FORBIDDEN)
	activities = LoginActivity.objects.select_related('user')[:100]
	return Response([{
		'id': item.id,
		'username': item.username,
		'ip': item.ip_address or 'Noma\'lum',
		'device': item.device or 'Noma\'lum qurilma',
		'userAgent': item.user_agent,
		'time': timezone.localtime(item.created_at).strftime('%d.%m.%Y %H:%M'),
	} for item in activities])


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([AllowAny])
def users(request):
	accounts = User.objects.filter(is_active=True).exclude(is_staff=True).exclude(is_superuser=True).order_by('username')
	return Response([
		{'id': user.id, 'username': user.username, 'name': user.first_name}
		for user in accounts
	])


@api_view(['DELETE'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def delete_account(request):
	user = request.user
	if _is_admin_user(user):
		return Response({'error': 'Admin akkauntini bu yerda o‘chirib bo‘lmaydi.'}, status=status.HTTP_400_BAD_REQUEST)
	username = user.username
	state = SocialState.objects.first()
	if state and state.payload:
		payload = state.payload
		for key in ('posts', 'reels', 'stories'):
			payload[key] = [item for item in payload.get(key, []) if item.get('userId') != username]
		payload['follows'] = [item for item in payload.get('follows', []) if item.get('a') != username and item.get('b') != username]
		payload['messages'] = [item for item in payload.get('messages', []) if item.get('from') != username and item.get('to') != username]
		payload['notifs'] = [item for item in payload.get('notifs', []) if item.get('from') != username and item.get('to') != username]
		state.payload = payload
		state.save(update_fields=['payload', 'updated_at'])
	auth_logout(request._request)
	user.delete()
	return Response({'message': 'Akkaunt o‘chirildi'})


@api_view(['DELETE'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def delete_user(request, username):
	if not _is_admin_user(request.user):
		return Response({'error': 'Faqat admin foydalanuvchi o‘chira oladi.'}, status=status.HTTP_403_FORBIDDEN)
	target = User.objects.filter(username=username).first()
	if not target:
		return Response({'error': 'Foydalanuvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	if _is_admin_user(target):
		return Response({'error': 'Admin akkauntini o‘chirib bo‘lmaydi.'}, status=status.HTTP_400_BAD_REQUEST)
	state = SocialState.objects.first()
	if state and state.payload:
		payload = state.payload
		for key in ('posts', 'reels', 'stories'):
			payload[key] = [item for item in payload.get(key, []) if item.get('userId') != username]
		payload['follows'] = [item for item in payload.get('follows', []) if item.get('a') != username and item.get('b') != username]
		payload['messages'] = [item for item in payload.get('messages', []) if item.get('from') != username and item.get('to') != username]
		payload['deletedMessages'] = [item for item in payload.get('deletedMessages', []) if item.get('from') != username and item.get('to') != username]
		payload['notifs'] = [item for item in payload.get('notifs', []) if item.get('from') != username and item.get('to') != username]
		state.payload = payload
		state.save(update_fields=['payload', 'updated_at'])
	target.delete()
	return Response({'message': 'Foydalanuvchi o‘chirildi'})


@api_view(['POST'])
def change_password(request):
	data = _body(request)
	username = _str(data, 'username').lower()
	current_password = data.get('current_password', '')
	new_password = data.get('new_password', '')
	if not isinstance(current_password, str):
		current_password = ''
	if not isinstance(new_password, str):
		new_password = ''
	user = authenticate(request, username=username, password=current_password)
	if not user:
		return Response({'error': 'Joriy parol noto‘g‘ri'}, status=status.HTTP_401_UNAUTHORIZED)
	if len(new_password) < 4:
		return Response({'error': 'Yangi parol kamida 4 ta belgi bo‘lsin'}, status=status.HTTP_400_BAD_REQUEST)
	user.set_password(new_password)
	user.save(update_fields=['password'])
	update_session_auth_hash(request._request, user)
	return Response({'message': 'Parol o‘zgartirildi'})


@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
	auth_logout(request._request)
	return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def social_updates(request):
	state = SocialState.objects.first()
	payload = state.payload or {} if state else {}
	username = request.user.username
	deleted_messages = [
		item for item in payload.get('deletedMessages', [])
		if item.get('from') == username or item.get('to') == username
	]
	deleted_ids = {str(item.get('id')) for item in deleted_messages}
	hidden_chats = [chat for chat in payload.get('hiddenChats', []) if chat.get('owner') == username]
	cutoffs = {chat.get('peer'): chat.get('cutoff', 0) for chat in hidden_chats}
	hidden_ids = {str(message_id) for chat in hidden_chats for message_id in chat.get('messageIds', [])}
	try:
		since = int(request.query_params.get('since', '0'))
	except (TypeError, ValueError):
		since = 0
	conversation_messages = [
		item for item in payload.get('messages', [])
		if (item.get('from') == username or item.get('to') == username)
		and str(item.get('id')) not in deleted_ids
		and str(item.get('id')) not in hidden_ids
		and item.get('t', 0) > cutoffs.get(item.get('to') if item.get('from') == username else item.get('from'), 0)
	]
	messages = [item for item in conversation_messages if item.get('t', 0) >= since]
	blocked_users = list(UserBlock.objects.filter(blocker=request.user).values_list('blocked__username', flat=True))
	blocked_by_users = list(UserBlock.objects.filter(blocked=request.user).values_list('blocker__username', flat=True))
	blocked_usernames = set(blocked_users) | set(blocked_by_users)
	follows = [
		item for item in payload.get('follows', [])
		if item.get('a') not in blocked_usernames and item.get('b') not in blocked_usernames
	]
	response = Response({
		'messages': messages,
		'postInteractions': _social_interactions(payload, 'posts'),
		'reelInteractions': _social_interactions(payload, 'reels'),
		'storyInteractions': _social_interactions(payload, 'stories'),
		'messageReactions': [
			{'id': str(item.get('id')), 'reactions': item.get('reactions', {})}
			for item in conversation_messages
			if 'reactions' in item
		],
		'voiceDurations': [
			{'id': str(item.get('id')), 'duration': item.get('mediaDuration')}
			for item in conversation_messages
			if item.get('mediaType') == 'audio' and item.get('mediaDuration')
		],
		'readMessageIds': [
			str(item.get('id')) for item in conversation_messages
			if item.get('read')
		],
		'deletedMessages': deleted_messages,
		'hiddenChats': hidden_chats,
		'blockedUsers': blocked_users,
		'blockedByUsers': blocked_by_users,
		'follows': follows,
		'notifs': [item for item in payload.get('notifs', []) if item.get('to') == username],
	})
	response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
	return response


def _social_interactions(payload, key):
	items = payload.get(key, [])
	if not isinstance(items, list):
		return []
	interactions = []
	for item in items:
		if not isinstance(item, dict) or not item.get('id'):
			continue
		likes = item.get('likes', [])
		comments = item.get('comments', [])
		interactions.append({
			'id': str(item['id']),
			'likes': [like for like in likes if isinstance(like, str)] if isinstance(likes, list) else [],
			'comments': [comment for comment in comments if isinstance(comment, dict)] if isinstance(comments, list) else [],
		})
	return interactions


@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def social_fast_action(request):
	data = request.data if isinstance(request.data, dict) else {}
	action = data.get('action')
	username = request.user.username
	if action not in ('follow', 'unfollow', 'message', 'read', 'read-notifs', 'call-log', 'react', 'voice-duration', 'like', 'comment', 'edit-comment', 'delete-comment'):
		return Response({'error': 'Amal qo‘llab-quvvatlanmaydi.'}, status=status.HTTP_400_BAD_REQUEST)
	if action not in ('read', 'read-notifs', 'call-log', 'voice-duration') and not is_service_open() and not _is_admin_user(request.user):
		return _closed_response()
	restriction = _active_restriction(request.user)
	if restriction and action in ('follow', 'unfollow', 'message', 'react', 'like', 'comment', 'edit-comment'):
		return Response({'error': 'Admin cheklovi faol.'}, status=status.HTTP_403_FORBIDDEN)
	with transaction.atomic():
		SocialState.objects.get_or_create(pk=1)
		state = SocialState.objects.select_for_update().get(pk=1)
		payload = state.payload or {}
		follows = payload.setdefault('follows', [])
		messages = payload.setdefault('messages', [])
		if action in ('like', 'comment', 'edit-comment', 'delete-comment'):
			kind = data.get('kind')
			content_key = {
				'post': 'posts',
				'reel': 'reels',
				'story': 'stories',
			}.get(kind)
			if not content_key or (action != 'like' and kind == 'story'):
				return Response({'error': 'Kontent turi noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
			item_id = str(data.get('itemId') or '')
			items = payload.setdefault(content_key, [])
			item = next((entry for entry in items if str(entry.get('id')) == item_id), None)
			if not item:
				return Response({'error': 'Kontent topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
			owner = _name(item.get('userId'))
			if owner and _users_block_each_other(username, owner):
				return Response({'error': 'Bloklangan foydalanuvchi kontentiga amal qilib bo‘lmaydi.'}, status=status.HTTP_403_FORBIDDEN)

			if action == 'like':
				likes = item.get('likes', [])
				likes = likes if isinstance(likes, list) else []
				liked = username in likes
				item['likes'] = [like for like in likes if like != username]
				if not liked:
					item['likes'].append(username)
					if owner and owner != username:
						payload.setdefault('notifs', []).append({
							'id': uuid.uuid4().hex, 'to': owner, 'from': username,
							'type': 'story_like' if kind == 'story' else 'like',
							'storyId' if kind == 'story' else 'postId': item_id,
							't': int(timezone.now().timestamp() * 1000), 'read': False,
						})
			else:
				comments = item.get('comments', [])
				if not isinstance(comments, list):
					comments = []
				comment_id = str(data.get('commentId') or '')
				comment = next((entry for entry in comments if str(entry.get('id')) == comment_id), None)
				if action == 'comment':
					text = data.get('text')
					if not isinstance(text, str) or not text.strip() or len(text.strip()) > 500:
						return Response({'error': 'Izoh 1–500 belgi bo‘lishi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
					error = validate_text(text.strip(), 'Izoh')
					if error:
						return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
					if not comment_id or len(comment_id) > 128 or any(str(entry.get('id')) == comment_id for entry in comments):
						return Response({'error': 'Izoh identifikatori noto‘g‘ri.'}, status=status.HTTP_409_CONFLICT)
					comment = {
						'id': comment_id, 'userId': username, 'text': text.strip(),
						't': int(timezone.now().timestamp() * 1000),
					}
					comments.append(comment)
					item['comments'] = comments
					if owner and owner != username:
						payload.setdefault('notifs', []).append({
							'id': uuid.uuid4().hex, 'to': owner, 'from': username,
							'type': 'comment', 'reelId' if kind == 'reel' else 'postId': item_id,
							'text': comment['text'], 't': comment['t'], 'read': False,
						})
				elif not comment or comment.get('userId') != username:
					return Response({'error': 'Izoh topilmadi yoki sizga tegishli emas.'}, status=status.HTTP_404_NOT_FOUND)
				elif action == 'edit-comment':
					text = data.get('text')
					if not isinstance(text, str) or not text.strip() or len(text.strip()) > 500:
						return Response({'error': 'Izoh 1–500 belgi bo‘lishi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
					error = validate_text(text.strip(), 'Izoh')
					if error:
						return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
					comment['text'] = text.strip()
				else:
					item['comments'] = [
						entry for entry in comments
						if str(entry.get('id')) != comment_id or entry.get('userId') != username
					]
			state.payload = payload
			state.save(update_fields=['payload', 'updated_at'])
			response = Response({
				'saved': True,
				'itemId': item_id,
				'kind': kind,
				'likes': item.get('likes', []),
				'comments': item.get('comments', []),
			})
			response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
			return response
		elif action in ('follow', 'unfollow'):
			target = User.objects.filter(username=_name(data.get('username'))).first()
			if not target or target == request.user:
				return Response({'error': 'Foydalanuvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
			if _users_block_each_other(username, target.username):
				return Response({'error': 'Bloklangan foydalanuvchini follow qilib bo‘lmaydi.'}, status=status.HTTP_403_FORBIDDEN)
			exists = any(item.get('a') == username and item.get('b') == target.username for item in follows)
			if action == 'follow' and not exists:
				follows.append({'a': username, 'b': target.username})
				payload.setdefault('notifs', []).append({
					'id': uuid.uuid4().hex, 'to': target.username, 'from': username,
					'type': 'follow', 't': int(timezone.now().timestamp() * 1000), 'read': False,
				})
			elif action == 'unfollow':
				payload['follows'] = [item for item in follows if not (item.get('a') == username and item.get('b') == target.username)]
		elif action == 'react':
			message_id = str(data.get('messageId', ''))
			emoji = data.get('emoji')
			if emoji != '❤️':
				return Response({'error': 'Faqat yurak reaksiyasi ruxsat etiladi.'}, status=status.HTTP_400_BAD_REQUEST)
			message = next((item for item in messages if str(item.get('id')) == message_id), None)
			if not message or username not in (message.get('from'), message.get('to')) or message.get('callEvent') or message.get('mediaType') == 'audio':
				return Response({'error': 'Bu xabarga reaksiya qoldirib bo‘lmaydi.'}, status=status.HTTP_404_NOT_FOUND)
			reactions = message.setdefault('reactions', {})
			if reactions.get(username) == emoji:
				reactions.pop(username, None)
			else:
				reactions[username] = emoji
			state.payload = payload
			state.save(update_fields=['payload', 'updated_at'])
			response = Response({'saved': True, 'reactions': reactions})
			response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
			return response
		elif action == 'voice-duration':
			message_id = str(data.get('messageId', ''))
			try:
				duration = max(1, min(86400, int(data.get('duration', 0))))
			except (TypeError, ValueError):
				return Response({'error': 'Ovoz davomiyligi noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
			message = next((item for item in messages if str(item.get('id')) == message_id), None)
			if not message or username not in (message.get('from'), message.get('to')) or message.get('mediaType') != 'audio':
				return Response({'error': 'Ovozli xabar topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
			message['mediaDuration'] = duration
			state.payload = payload
			state.save(update_fields=['payload', 'updated_at'])
			response = Response({'saved': True, 'duration': duration})
			response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
			return response
		elif action == 'read':
			sender = str(data.get('from', ''))
			for message in messages:
				if message.get('from') == sender and message.get('to') == username:
					message['read'] = True
		elif action == 'read-notifs':
			for notification in payload.setdefault('notifs', []):
				if notification.get('to') == username:
					notification['read'] = True
		else:
			message = data.get('message')
			if not isinstance(message, dict):
				return Response({'error': 'Xabar ma’lumoti noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
			message = dict(message)
			if action == 'call-log':
				call_event = message.get('callEvent')
				if not isinstance(call_event, dict) or call_event.get('mode') not in ('audio', 'video') or call_event.get('status') not in ('ended', 'declined', 'missed', 'failed'):
					return Response({'error': 'Qo‘ng‘iroq yozuvi noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
				try:
					call_event['duration'] = max(0, min(86400, int(call_event.get('duration', 0))))
				except (TypeError, ValueError):
					return Response({'error': 'Qo‘ng‘iroq davomiyligi noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
			target = User.objects.filter(username=_name(message.get('to'))).first()
			if not target or target == request.user:
				return Response({'error': 'Qabul qiluvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
			if _users_block_each_other(username, target.username):
				return Response({'error': 'Bu suhbatda xabar yuborib bo‘lmaydi.'}, status=status.HTTP_403_FORBIDDEN)
			message_id = str(message.get('id') or uuid.uuid4().hex)
			if any(str(item.get('id')) == message_id for item in messages):
				return Response({'saved': True, 'duplicate': True})
			message.update({'id': message_id, 'from': username, 'to': target.username, 'read': False})
			text = str(message.get('text') or '')
			if message.get('src'):
				error = validate_media_item({'media': message['src']})
				if error:
					return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
			adult_text = suspected_adult_text(text)
			sanitized = False
			if adult_text and message.get('src') and message.get('mediaType') in ('image', 'video'):
				message['text'] = ''
				sanitized = True
			elif adult_text:
				moderation = _queue_moderation(request.user, 'message', message, '18+ bo‘lishi mumkin bo‘lgan xabar matni')
				return Response({'saved': False, 'moderation': [moderation]})
			error = validate_text(message.get('text', ''), 'Xabar')
			if error:
				return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
			messages.append(message)
			state.payload = payload
			state.save(update_fields=['payload', 'updated_at'])
			response = Response({'saved': True, 'sanitized': sanitized, 'messageId': message_id})
			response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
			return response
		state.payload = payload
		state.save(update_fields=['payload', 'updated_at'])
	response = Response({'saved': True})
	response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
	return response


@api_view(['GET', 'PUT'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def social_state(request):
	if request.method == 'PUT':
		# Bir vaqtda bir nechta foydalanuvchi yozsa, bir-birining ma'lumotini o'chirib yubormasin
		with transaction.atomic():
			SocialState.objects.get_or_create(pk=1)
			SocialState.objects.select_for_update().get(pk=1)
			return _social_state_impl(request)
	return _social_state_impl(request)


def _social_state_impl(request):
	if request.method == 'PUT' and not is_service_open() and not _is_admin_user(request.user):
		return _closed_response()
	state, _ = SocialState.objects.get_or_create(pk=1)
	payload = state.payload or {}
	username = request.user.username
	keys = ('posts', 'reels', 'stories', 'seenStories', 'follows', 'messages', 'deletedMessages', 'notifs', 'saved')

	if request.method == 'GET':
		response_data = {key: payload.get(key, [] if key != 'saved' else {}) for key in keys}
		hidden_chats = [chat for chat in payload.get('hiddenChats', []) if chat.get('owner') == username]
		cutoffs = {chat.get('peer'): chat.get('cutoff', 0) for chat in hidden_chats}
		hidden_message_ids = {str(message_id) for chat in hidden_chats for message_id in chat.get('messageIds', [])}
		deleted_ids = {item.get('id') for item in response_data['deletedMessages']}
		response_data['messages'] = [
			item for item in response_data['messages']
			if (item.get('from') == username or item.get('to') == username)
			and item.get('id') not in deleted_ids
			and str(item.get('id')) not in hidden_message_ids
			and (
				(item.get('to') if item.get('from') == username else item.get('from')) not in cutoffs
				or item.get('t', 0) > cutoffs[item.get('to') if item.get('from') == username else item.get('from')]
			)
		]
		response_data['deletedMessages'] = [
			item for item in response_data['deletedMessages']
			if item.get('from') == username or item.get('to') == username
		]
		response_data['notifs'] = [item for item in response_data['notifs'] if item.get('to') == username]
		owned_story_ids = {item.get('id') for item in response_data['stories'] if item.get('userId') == username}
		response_data['seenStories'] = [
			item for item in response_data['seenStories']
			if item.get('viewerId') == username or item.get('storyId') in owned_story_ids
		]
		response_data['saved'] = {username: response_data['saved'].get(username, [])}
		response_data['hiddenChats'] = hidden_chats
		blocked_users = list(UserBlock.objects.filter(blocker=request.user).values_list('blocked__username', flat=True))
		blocked_by_users = list(UserBlock.objects.filter(blocked=request.user).values_list('blocker__username', flat=True))
		response_data['blockedUsers'] = blocked_users
		response_data['blockedByUsers'] = blocked_by_users
		hidden_usernames = set(blocked_users) | set(blocked_by_users)
		response_data['follows'] = [
			follow for follow in response_data['follows']
			if follow.get('a') not in hidden_usernames and follow.get('b') not in hidden_usernames
		]
		response = Response(response_data)
		response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
		return response

	incoming = request.data
	if not isinstance(incoming, dict):
		return Response({'error': 'Noto‘g‘ri ma’lumot formati'}, status=status.HTTP_400_BAD_REQUEST)
	incoming = dict(incoming)
	# Ro'yxat ichida lug'at bo'lmagan elementlar (matn, son...) serverni qulatmasligi uchun tashlab yuboriladi
	for key in ('posts', 'reels', 'stories', 'seenStories', 'follows', 'messages', 'deletedMessages', 'notifs'):
		if isinstance(incoming.get(key), list):
			incoming[key] = [item for item in incoming[key] if isinstance(item, dict)]
	for key in ('posts', 'reels'):
		for item in incoming.get(key) or []:
			if 'comments' in item:
				comments = item['comments']
				item['comments'] = [c for c in comments if isinstance(c, dict)] if isinstance(comments, list) else []
			if 'likes' in item and not isinstance(item['likes'], list):
				item['likes'] = []
	moderation_items = []
	rejected_media = []
	sanitized_messages = []
	blocked_messages = []
	restriction = _active_restriction(request.user)

	# Server-side 7+ moderation. Only content owned/created by the authenticated user
	# is inspected here; remote content belonging to other users is not rewritten.
	for key, content_type in (('posts', 'post'), ('reels', 'reel'), ('stories', 'story')):
		items = incoming.get(key, []) or []
		if not isinstance(items, list):
			return Response({'error': f'{key} ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
		filtered_items = []
		existing_ids = {str(item.get('id')) for item in payload.get(key, [])}
		for item in items:
			if item.get('userId') == username:
				adult_caption = suspected_adult_text(item.get('caption', ''))
				error = validate_media_item(item, check_caption=not adult_caption)
				if error:
					return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
				new_item = str(item.get('id')) not in existing_ids
				if new_item and not restriction and adult_caption:
					rejected_media.append({'type': content_type, 'id': str(item.get('id'))})
					continue
			filtered_items.append(item)
		incoming[key] = filtered_items
		if restriction:
			old_owned = {str(item.get('id')): item for item in payload.get(key, []) if item.get('userId') == username}
			requested_owned = [item for item in filtered_items if item.get('userId') == username]
			preserved_owned = [old_owned.pop(str(item.get('id'))) for item in requested_owned if str(item.get('id')) in old_owned]
			preserved_owned.extend(old_owned.values())
			incoming[key] = [item for item in filtered_items if item.get('userId') != username] + preserved_owned

	for key in ('posts', 'reels'):
		for item in incoming.get(key, []) or []:
			for comment in item.get('comments', []) or []:
				if comment.get('userId') == username:
					text = str(comment.get('text', ''))
					if len(text) > 500:
						return Response({'error': 'Izoh 500 belgidan oshmasligi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
					error = validate_text(text, 'Izoh')
					if error:
						return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

	new_messages = incoming.get('messages', []) or []
	if not isinstance(new_messages, list):
		return Response({'error': 'messages ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
	filtered_messages = []
	existing_messages = {str(item.get('id')): item for item in payload.get('messages', [])}
	for message in new_messages:
		if message.get('from') == username:
			old_message = existing_messages.get(str(message.get('id')))
			adult_message = suspected_adult_text(message.get('text', ''))
			changed_message = not old_message or any(
				message.get(field) != old_message.get(field) for field in ('text', 'src', 'mediaType')
			)
			recipient = User.objects.filter(username=_name(message.get('to'))).first()
			if changed_message and recipient and _users_block_each_other(username, recipient.username):
				blocked_messages.append(str(message.get('id')))
				continue
			if message.get('src'):
				error = validate_media_item({'media': message.get('src')})
				if error:
					return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
			if changed_message and recipient and not restriction and adult_message:
				if message.get('src') and message.get('mediaType') in ('image', 'video'):
					message['text'] = ''
					sanitized_messages.append(str(message.get('id')))
				else:
					moderation_items.append(_queue_moderation(request.user, 'message', message, '18+ bo‘lishi mumkin bo‘lgan xabar matni'))
					continue
			if restriction and changed_message:
				continue
			error = validate_text(message.get('text', ''), 'Xabar')
			if error:
				return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
		filtered_messages.append(message)
	incoming['messages'] = filtered_messages

	for key in ('posts', 'reels', 'stories'):
		old_items = payload.get(key, [])
		new_items = incoming.get(key, [])
		if not isinstance(new_items, list):
			return Response({'error': f'{key} ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
		payload[key] = _merge_owned_media(old_items, new_items, username, allow_interactions=not restriction)

	new_seen_stories = incoming.get('seenStories', [])
	if not isinstance(new_seen_stories, list):
		return Response({'error': 'seenStories ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
	payload['seenStories'] = [
		item for item in payload.get('seenStories', []) if item.get('viewerId') != username
	] + [item for item in new_seen_stories if item.get('viewerId') == username]

	new_follows = incoming.get('follows', [])
	if not isinstance(new_follows, list):
		return Response({'error': 'follows ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
	old_user_follows = [item for item in payload.get('follows', []) if item.get('a') == username]
	user_follows = [item for item in new_follows if item.get('a') == username]
	if restriction:
		old_targets = {item.get('b') for item in old_user_follows}
		user_follows = [item for item in user_follows if item.get('b') in old_targets]
	payload['follows'] = [item for item in payload.get('follows', []) if item.get('a') != username] + user_follows

	old_messages = payload.get('messages', [])
	new_messages = incoming.get('messages', [])
	if not isinstance(new_messages, list):
		return Response({'error': 'messages ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
	message_map = {item.get('id'): item for item in old_messages}
	for item in new_messages:
		message_id = item.get('id')
		old_item = message_map.get(message_id)
		if old_item:
			if old_item.get('from') == username and not restriction:
				for key in ('text', 'src', 'mediaType', 'edited', 'storyId', 'storyOwner'):
					if key in item:
						old_item[key] = item[key]
			if old_item.get('to') == username and item.get('read'):
				# O'qilgan xabar hech qachon qaytib "o'qilmagan" bo'lmaydi (eski/kech kelgan so'rovlar uchun)
				old_item['read'] = True
			hidden_for = set(old_item.get('hiddenFor', []))
			hidden_for.discard(username)
			if username in item.get('hiddenFor', []):
				hidden_for.add(username)
			old_item['hiddenFor'] = list(hidden_for)
		elif not old_item and item.get('from') == username and not restriction and User.objects.filter(username=_name(item.get('to'))).exists():
			message_map[message_id] = item
	payload['messages'] = list(message_map.values())

	deleted_messages = {item.get('id'): item for item in payload.get('deletedMessages', [])}
	new_deleted_messages = incoming.get('deletedMessages', [])
	if not isinstance(new_deleted_messages, list):
		return Response({'error': 'deletedMessages ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
	for item in new_deleted_messages:
		message = message_map.get(item.get('id'))
		if message and message.get('from') == username:
			deleted_messages[item.get('id')] = {'id': item.get('id'), 'from': username, 'to': message.get('to')}
	payload['deletedMessages'] = list(deleted_messages.values())

	old_notifs = payload.get('notifs', [])
	new_notifs = incoming.get('notifs', [])
	if not isinstance(new_notifs, list):
		return Response({'error': 'notifs ro‘yxat bo‘lishi kerak'}, status=status.HTTP_400_BAD_REQUEST)
	notif_map = {item.get('id'): item for item in old_notifs if item.get('to') != username}
	for item in old_notifs:
		if item.get('to') == username:
			notif_map[item.get('id')] = item
	for item in new_notifs:
		if item.get('to') == username and item.get('id') in notif_map:
			if item.get('read'):
				notif_map[item.get('id')]['read'] = True
		elif item.get('from') == username and User.objects.filter(username=_name(item.get('to'))).exists():
			notif_map[item.get('id')] = item
	payload['notifs'] = list(notif_map.values())

	saved = payload.get('saved', {})
	incoming_saved = incoming.get('saved', {})
	if isinstance(incoming_saved, dict):
		saved[username] = incoming_saved.get(username, [])
	payload['saved'] = saved
	state.payload = payload
	state.save(update_fields=['payload', 'updated_at'])
	response = Response({'saved': True, 'moderation': moderation_items, 'rejectedMedia': rejected_media, 'sanitizedMessages': sanitized_messages, 'blockedMessages': blocked_messages})
	response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
	return response


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def moderation_queue(request):
	if not _is_admin_user(request.user):
		return Response({'error': 'Faqat admin uchun.'}, status=status.HTTP_403_FORBIDDEN)
	reports = ModerationReport.objects.filter(status=ModerationReport.PENDING).select_related('user')
	return Response([{
		'id': report.id,
		'username': report.username,
		'type': report.content_type,
		'contentId': report.content_id,
		'content': report.content,
		'reason': report.reason,
		'time': timezone.localtime(report.created_at).strftime('%d.%m.%Y %H:%M'),
	} for report in reports])


@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def moderation_review(request, report_id):
	if not _is_admin_user(request.user):
		return Response({'error': 'Faqat admin uchun.'}, status=status.HTTP_403_FORBIDDEN)
	report = ModerationReport.objects.filter(pk=report_id, status=ModerationReport.PENDING).first()
	if not report:
		return Response({'error': 'Tekshiruv elementi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	body = _body(request)
	action = body.get('action')
	if action not in ('approve', 'reject', 'restrict'):
		return Response({'error': 'Amal approve, reject yoki restrict bo‘lishi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
	if action == 'restrict':
		days = body.get('days')
		if days not in (3, 4, '3', '4'):
			return Response({'error': 'Cheklov 3 yoki 4 kun bo‘lishi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
		if not report.user:
			return Response({'error': 'Foydalanuvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
		until = timezone.now() + timedelta(days=int(days))
		UserRestriction.objects.update_or_create(
			user=report.user,
			defaults={'restricted_until': until, 'reason': '18+ kontent', 'created_by': request.user},
		)
		if report.content_type == 'reel_report':
			_remove_reported_reel(report)
		report.status = ModerationReport.RESTRICTED
		report.reviewed_at = timezone.now()
		report.save(update_fields=['status', 'reviewed_at'])
		return Response({'reviewed': True, 'status': report.status, 'restrictedUntil': timezone.localtime(until).isoformat()})
	if report.content_type == 'reel_report':
		if action == 'reject':
			_remove_reported_reel(report)
		report.status = ModerationReport.APPROVED if action == 'approve' else ModerationReport.REJECTED
		report.reviewed_at = timezone.now()
		report.save(update_fields=['status', 'reviewed_at'])
		return Response({'reviewed': True, 'status': report.status})
	if action == 'approve':
		state, _ = SocialState.objects.get_or_create(pk=1)
		payload = state.payload or {}
		key = {'post': 'posts', 'reel': 'reels', 'story': 'stories', 'message': 'messages'}.get(report.content_type)
		if not key:
			return Response({'error': 'Kontent turi qo‘llab-quvvatlanmaydi.'}, status=status.HTTP_400_BAD_REQUEST)
		items = payload.setdefault(key, [])
		if not any(str(item.get('id')) == report.content_id for item in items):
			items.append(report.content)
		state.payload = payload
		state.save(update_fields=['payload', 'updated_at'])
	report.status = ModerationReport.APPROVED if action == 'approve' else ModerationReport.REJECTED
	report.reviewed_at = timezone.now()
	report.save(update_fields=['status', 'reviewed_at'])
	return Response({'reviewed': True, 'status': report.status})


def _remove_reported_reel(report):
	state = SocialState.objects.first()
	if not state or not state.payload:
		return
	payload = state.payload
	payload['reels'] = [item for item in payload.get('reels', []) if str(item.get('id')) != report.content_id]
	state.payload = payload
	state.save(update_fields=['payload', 'updated_at'])


@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def report_reel(request, reel_id):
	body = _body(request)
	reason = body.get('reason')
	allowed_reasons = {'adult', 'violence', 'harassment', 'spam', 'other'}
	if not isinstance(reason, str) or reason not in allowed_reasons:
		return Response({'error': 'Shikoyat sababini tanlang.'}, status=status.HTTP_400_BAD_REQUEST)
	state = SocialState.objects.first()
	reel = next((
		item for item in (state.payload.get('reels', []) if state and state.payload else [])
		if str(item.get('id')) == str(reel_id)
	), None)
	if not reel:
		return Response({'error': 'Reels topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	owner = User.objects.filter(username=reel.get('userId')).first()
	if not owner:
		return Response({'error': 'Reels muallifi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	if owner.pk == request.user.pk:
		return Response({'error': 'O‘z Reelsingiz ustidan shikoyat qila olmaysiz.'}, status=status.HTTP_400_BAD_REQUEST)
	details = str(body.get('details', '')).strip()[:500]
	open_reports = ModerationReport.objects.filter(
		user=owner, content_type='reel_report', content_id=str(reel_id), status=ModerationReport.PENDING,
	)
	if any(report.content.get('reportedBy') == request.user.username for report in open_reports):
		return Response({'error': 'Bu Reels ustidan shikoyat allaqachon yuborgansiz.'}, status=status.HTTP_409_CONFLICT)
	content = {
		**reel,
		'reportReason': reason,
		'reportDetails': details,
		'reportedBy': request.user.username,
	}
	ModerationReport.objects.create(
		user=owner, username=owner.username, content_type='reel_report', content_id=str(reel_id),
		content=content, reason=reason,
	)
	return Response({'reported': True}, status=status.HTTP_201_CREATED)


@api_view(['POST', 'DELETE'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def block_user(request, username):
	target = User.objects.filter(username=username).first()
	if not target:
		return Response({'error': 'Foydalanuvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	if target.pk == request.user.pk:
		return Response({'error': 'O‘zingizni bloklay olmaysiz.'}, status=status.HTTP_400_BAD_REQUEST)
	if _is_admin_user(target):
		return Response({'error': 'Admin akkauntini bloklab bo‘lmaydi.'}, status=status.HTTP_400_BAD_REQUEST)
	if request.method == 'POST':
		UserBlock.objects.get_or_create(blocker=request.user, blocked=target)
		state = SocialState.objects.first()
		if state and state.payload:
			payload = state.payload
			payload['follows'] = [
				follow for follow in payload.get('follows', [])
				if not (
					(follow.get('a') == request.user.username and follow.get('b') == target.username) or
					(follow.get('a') == target.username and follow.get('b') == request.user.username)
				)
			]
			state.payload = payload
			state.save(update_fields=['payload', 'updated_at'])
		return Response({'blocked': True, 'username': target.username})
	UserBlock.objects.filter(blocker=request.user, blocked=target).delete()
	return Response({'blocked': False, 'username': target.username})


@api_view(['DELETE'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def delete_chat(request, username):
	target = User.objects.filter(username=username).first()
	if not target:
		return Response({'error': 'Foydalanuvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	state, _ = SocialState.objects.get_or_create(pk=1)
	payload = state.payload or {}
	conversation_messages = [
		message for message in payload.get('messages', [])
		if (message.get('from') == request.user.username and message.get('to') == target.username) or
		(message.get('from') == target.username and message.get('to') == request.user.username)
	]
	hidden_message_ids = [str(message.get('id')) for message in conversation_messages]
	hidden_chats = [
		chat for chat in payload.get('hiddenChats', [])
		if not (chat.get('owner') == request.user.username and chat.get('peer') == target.username)
	]
	cutoff = int(timezone.now().timestamp() * 1000)
	hidden_chats.append({'owner': request.user.username, 'peer': target.username, 'cutoff': cutoff, 'messageIds': hidden_message_ids})
	payload['hiddenChats'] = hidden_chats
	state.payload = payload
	state.save(update_fields=['payload', 'updated_at'])
	return Response({'deleted': True, 'cutoff': cutoff, 'hiddenMessageIds': hidden_message_ids})


@api_view(['GET', 'POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def call_signals(request):
	if request.method == 'GET':
		# Har so'rovda o'chirish (yozish) kerak emas — SQLite'ni band qilib qo'yardi. Faqat ba'zan tozalaymiz.
		if random.random() < 0.02:
			CallSignal.objects.filter(created_at__lt=timezone.now() - timedelta(hours=2)).delete()
		signals = list(CallSignal.objects.filter(recipient=request.user, delivered_at__isnull=True).select_related('sender'))
		if signals:
			CallSignal.objects.filter(pk__in=[signal.pk for signal in signals]).update(delivered_at=timezone.now())
		return Response([{
			'id': signal.id,
			'callId': signal.call_id,
			'from': signal.sender.username,
			'action': signal.action,
			'payload': signal.payload,
			'createdAt': signal.created_at.isoformat(),
		} for signal in signals])

	data = request.data if isinstance(request.data, dict) else {}
	call_id = str(data.get('callId', ''))
	username = str(data.get('to', ''))
	action = data.get('action')
	payload = data.get('payload', {})
	allowed_actions = {'invite', 'accept', 'reject', 'offer', 'answer', 'candidate', 'end'}
	if not call_id or len(call_id) > 64 or not call_id.replace('-', '').replace('_', '').isalnum():
		return Response({'error': 'Qo‘ng‘iroq identifikatori noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
	if not isinstance(action, str) or action not in allowed_actions or not isinstance(payload, dict) or len(str(payload)) > 200000:
		return Response({'error': 'Qo‘ng‘iroq signali noto‘g‘ri.'}, status=status.HTTP_400_BAD_REQUEST)
	target = User.objects.filter(username=username).first()
	if not target or target.pk == request.user.pk:
		return Response({'error': 'Qabul qiluvchi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	if _users_block_each_other(request.user.username, target.username):
		return Response({'error': 'Bloklangan foydalanuvchiga qo‘ng‘iroq qilib bo‘lmaydi.'}, status=status.HTTP_403_FORBIDDEN)
	if action == 'invite':
		if payload.get('mode') not in ('audio', 'video'):
			return Response({'error': 'Qo‘ng‘iroq turi audio yoki video bo‘lishi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
		if CallSignal.objects.filter(call_id=call_id).exists():
			return Response({'error': 'Bu qo‘ng‘iroq identifikatori ishlatilgan.'}, status=status.HTTP_409_CONFLICT)
	else:
		participants = CallSignal.objects.filter(call_id=call_id).filter(
			Q(sender=request.user, recipient=target) | Q(sender=target, recipient=request.user)
		)
		if not participants.exists():
			return Response({'error': 'Qo‘ng‘iroq sessiyasi topilmadi.'}, status=status.HTTP_404_NOT_FOUND)
	CallSignal.objects.create(
		call_id=call_id, sender=request.user, recipient=target, action=action, payload=payload,
	)
	return Response({'sent': True}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def presence_status(request):
	now = timezone.now()
	UserPresence.objects.update_or_create(user=request.user, defaults={'last_seen': now})
	state = SocialState.objects.first()
	messages = state.payload.get('messages', []) if state and state.payload else []
	peer_usernames = {
		message.get('to') if message.get('from') == request.user.username else message.get('from')
		for message in messages
		if message.get('from') == request.user.username or message.get('to') == request.user.username
	}
	peer_usernames.discard(None)
	blocked_usernames = set(UserBlock.objects.filter(blocker=request.user).values_list('blocked__username', flat=True))
	blocked_usernames.update(UserBlock.objects.filter(blocked=request.user).values_list('blocker__username', flat=True))
	peer_usernames -= blocked_usernames
	presence_by_username = {
		presence.user.username: presence.last_seen
		for presence in UserPresence.objects.filter(user__username__in=peer_usernames).select_related('user')
	}
	return Response({'users': [{
		'username': username,
		'online': username in presence_by_username and presence_by_username[username] >= now - timedelta(seconds=60),
		'lastSeen': presence_by_username[username].isoformat() if username in presence_by_username else None,
	} for username in sorted(peer_usernames)]})


@api_view(['GET'])
def public_config(request):
	return Response({'googleClientId': django_settings.GOOGLE_CLIENT_ID})


def _verify_google_token(credential):
	"""Google ID tokenni Google serveri orqali tekshiradi. Yaroqli bo'lsa payload qaytaradi."""
	if not credential or not django_settings.GOOGLE_CLIENT_ID:
		return None
	url = 'https://oauth2.googleapis.com/tokeninfo?' + urllib.parse.urlencode({'id_token': credential})
	try:
		with urllib.request.urlopen(url, timeout=8) as response:
			data = json.loads(response.read().decode('utf-8'))
	except Exception:
		return None
	if data.get('aud') != django_settings.GOOGLE_CLIENT_ID:
		return None
	if data.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
		return None
	if str(data.get('email_verified')).lower() != 'true' or not data.get('email'):
		return None
	try:
		if int(data.get('exp', 0)) < int(timezone.now().timestamp()):
			return None
	except (TypeError, ValueError):
		return None
	return data


def _unique_username(email, name):
	base = re.sub(r'[^a-z0-9._]', '', email.split('@')[0].lower()) or re.sub(r'[^a-z0-9._]', '', name.lower()) or 'user'
	base = base[:30].ljust(3, '0')
	candidate, n = base, 1
	while User.objects.filter(username=candidate).exists():
		n += 1
		candidate = f'{base[:26]}{n}'
	return candidate


@api_view(['POST'])
def google_login(request):
	"""Google akkaunt bilan kirish / ro'yxatdan o'tish."""
	data = _verify_google_token(_str(_body(request), 'credential'))
	if not data:
		return Response({'error': 'Google orqali tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.'}, status=status.HTTP_401_UNAUTHORIZED)
	email = data['email'].strip().lower()
	name = (data.get('name') or email.split('@')[0]).strip()
	user = User.objects.filter(email__iexact=email).first()
	created = False
	if not user:
		if not is_service_open():
			return _closed_response('hours')
		user = User.objects.create_user(username=_unique_username(email, name), email=email, first_name=name[:150])
		user.set_unusable_password()
		user.save()
		created = True
	elif not is_service_open() and not _is_admin_user(user):
		return _closed_response('hours')
	UsageState.objects.get_or_create(user=user)
	if not _is_admin_user(user) and not _usage_status(user, touch=False)['allowed']:
		return _closed_response('cooldown')
	auth_login(request._request, user, backend='django.contrib.auth.backends.ModelBackend')
	_record_login(request._request, user)
	return Response(
		{'id': user.id, 'username': user.username, 'email': user.email, 'name': user.first_name or user.username, 'csrfToken': get_token(request._request)},
		status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
	)
