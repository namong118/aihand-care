-- =====================================================================
-- 손잇다 보호자 앱 (#62) Supabase 스키마
-- 설계: docs/guardian-app.md 4번 "Supabase에 두는 것", 8번 "운영"
-- 코스 요약 형식: docs/course.md 4번
-- =====================================================================
--
-- ■ 넣는 방법
--   1. Supabase 대시보드 → 프로젝트 → 왼쪽 메뉴 "SQL Editor" → "New query"
--   2. 이 파일 전체를 복사해 붙여 넣고 "Run"
--   3. 아래쪽에 "Success. No rows returned"가 나오면 끝
--   - 두 번 붙여 넣어도 에러가 나지 않는다 (if not exists, create or replace).
--     함수를 고쳤으면 이 파일을 다시 붙여 넣으면 된다.
--   - ⚠️ 표의 칸을 바꾼 경우는 다시 붙여 넣어도 표가 바뀌지 않는다 ("이미 있으면 그대로").
--     그때는 alter table 문을 따로 만들어 넣는다.
--   - 1년 지난 요약 지우기(pg_cron)가 안 되면 "pg_cron을 켜지 못했어요" 안내가 나온다.
--     에러가 아니라 안내라 나머지는 그대로 만들어진다 (맨 아래 8번 참고).
--
-- ■ 스테이션 비밀값 넣기 (설계 4번 "스테이션 비밀값")
--   비밀값 자체는 Supabase·저장소·PR·팀 채팅 어디에도 쓰지 않는다. Supabase에는 "해시"만 넣는다.
--   해시: 비밀값을 섞어서 만든 64글자. 해시로는 비밀값을 되돌려 알아낼 수 없다.
--
--   1. 라즈베리파이 터미널, 앱 폴더에서 (비밀값이 화면과 명령 기록에 남지 않는다)
--        printf 'VITE_STATION_KEY=%s\n' "$(openssl rand -hex 32)" >> .env.local
--        grep '^VITE_STATION_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | sha256sum
--      → 맨 앞 64글자가 해시다. (맥에서는 sha256sum 대신 shasum -a 256)
--      ※ .env.local 에는 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 도 있어야 한다 (설계 8번)
--   2. SQL Editor 에서 (해시와 이름표만 넣는다)
--        insert into public.station_keys (key_hash, label) values ('<해시 64글자>', 'raspi-시연');
--   3. 확인: select label, created_at from public.station_keys;
--   - 비밀값이 새어 나간 것 같으면: 새 비밀값으로 1~2번을 다시 하고, 옛 줄을 지운 뒤 다시 빌드한다
--        delete from public.station_keys where label = 'raspi-시연';
--
-- ■ 시험용 비밀값 (개발 PC)
--   라즈베리파이 비밀값을 나눠 쓰지 않는다. 개발 PC에서 위 1번처럼 따로 만들고,
--   label 을 'dev-경민'처럼 붙여 넣는다. ⚠️ 시험이 끝나면 꼭 지운다:
--        delete from public.station_keys where label = 'dev-경민';
--
-- ■ 앱이 부르는 방법 (@supabase/supabase-js 없이 fetch)
--   POST <VITE_SUPABASE_URL>/rest/v1/rpc/<함수 이름>
--   머리글: apikey: <공개 키>, Authorization: Bearer <공개 키>, Content-Type: application/json
--   본문: 함수 인자 이름 그대로, 예) { "station_key": "...", "code": "...", "user_id": "..." }
--
-- ■ 여기 두지 않는 것: 얼굴 사진·특징값, 실명, 연락처, 호칭(displayName), 비밀값 자체
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 확장 기능
-- ---------------------------------------------------------------------
-- pgcrypto: 비밀값의 해시(sha256)를 구할 때 쓴다. Supabase에는 보통 이미 켜져 있다.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------
-- 2. 표 3개
-- ---------------------------------------------------------------------

-- 연결 코드 → 사용자. 연결을 끊으면 revoked_at 을 채운다 (줄은 남긴다).
create table if not exists public.pairings (
  code       text        not null,
  user_id    text        not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint pairings_pkey primary key (code),
  -- 연결 코드: 12글자, 헷갈리는 0·O·1·I·L 을 뺀 31글자 (src/guardian/logic.js CODE_CHARS)
  constraint pairings_code_format check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$'),
  constraint pairings_user_id_length check (char_length(user_id) between 1 and 100)
);
create index if not exists pairings_user_id_idx on public.pairings (user_id);

-- 코스 요약. docs/course.md 4번 형식 그대로 summary 칸에 통째로 넣는다.
-- 같은 (user_id, course_id) 는 한 번만 저장된다 (다시 보내도 괜찮다).
create table if not exists public.summaries (
  user_id    text        not null,
  course_id  text        not null,
  summary    jsonb       not null,
  created_at timestamptz not null default now(),
  constraint summaries_pkey primary key (user_id, course_id),
  constraint summaries_summary_object check (jsonb_typeof(summary) = 'object')
);
create index if not exists summaries_created_at_idx on public.summaries (created_at);

-- 스테이션 비밀값의 해시 (64글자, 0-9 a-f). 비밀값 자체는 두지 않는다.
-- label: 어느 기기 것인지 알아보는 이름표 (예: 'raspi-시연', 'dev-경민')
create table if not exists public.station_keys (
  key_hash   text        not null,
  label      text        not null,
  created_at timestamptz not null default now(),
  constraint station_keys_pkey primary key (key_hash),
  constraint station_keys_hash_format check (key_hash ~ '^[0-9a-f]{64}$')
);


-- ---------------------------------------------------------------------
-- 3. 표를 직접 읽고 쓰지 못하게 막기 (RLS)
-- ---------------------------------------------------------------------
-- 공개 키(anon key)는 앱 안에 들어가 누구나 볼 수 있다.
-- 그래서 표는 막아 두고, 아래 4~5번의 함수로만 다루게 한다.
-- RLS를 켜고 허용 규칙(policy)을 하나도 만들지 않으면 공개 키로는 한 줄도 읽고 쓸 수 없다.
alter table public.pairings     enable row level security;
alter table public.summaries    enable row level security;
alter table public.station_keys enable row level security;

-- 한 번 더: 공개 키 쪽 역할(anon, authenticated)의 표 권한도 모두 뺀다.
revoke all on table public.pairings, public.summaries, public.station_keys from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. 도우미 함수 (앱에서는 부를 수 없다)
-- ---------------------------------------------------------------------
-- 함수 공통:
--   security definer  → 함수를 만든 사람(관리자) 권한으로 돌아서, 막아 둔 표를 다룰 수 있다
--   set search_path = '' → 이름을 몰래 바꿔치기하지 못하게, 표·함수 이름을 public.pairings 처럼 다 적는다
--   함수 안에서 인자는 "함수이름.인자"로 적는다 (표의 칸 이름과 헷갈리지 않게)

-- 스테이션 비밀값이 맞는지 본다. 틀리면 에러를 내고, 부른 함수도 아무것도 하지 않고 끝난다.
create or replace function public.check_station_key(station_key text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if check_station_key.station_key is null or not exists (
    select 1
    from public.station_keys k
    where k.key_hash = encode(extensions.digest(check_station_key.station_key, 'sha256'), 'hex')
  ) then
    -- 28000 → 앱에는 HTTP 403 으로 간다
    raise exception '스테이션 비밀값이 맞지 않아요' using errcode = '28000';
  end if;
end;
$$;

-- 1년 지난 요약을 지운다. 지운 개수를 돌려준다. (7번 pg_cron이 하루 한 번 부른다)
-- pg_cron이 안 되면 SQL Editor에서 손으로: select public.delete_old_summaries();
create or replace function public.delete_old_summaries()
returns integer
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.summaries s
    where s.created_at < now() - interval '1 year'
    returning 1
  )
  select count(*)::integer from gone;
$$;


-- ---------------------------------------------------------------------
-- 5. 스테이션이 부르는 함수 4개 (비밀값 필요)
-- ---------------------------------------------------------------------
-- 비밀값이 틀리면 에러(403)를 내고 아무것도 하지 않는다.
-- 성공하면 무엇을 했는지 짧은 글자를 돌려준다. 스테이션은 성공(200)이면 대기열에서 뺀다.

-- 연결 코드 등록 (대기열 kind: 'pairing')
-- 돌려주는 값: 'registered' 새로 등록 / 'already' 이미 같은 분으로 등록됨 (다시 보내도 괜찮다)
-- 한 번 끊은 코드는 다시 보내도 살리지 않는다 ('already').
-- 코드가 이미 다른 분께 묶여 있으면 에러 (코드 하나는 한 분에게만).
create or replace function public.register_pairing(station_key text, code text, user_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner text;
begin
  perform public.check_station_key(register_pairing.station_key);

  if register_pairing.code is null
     or register_pairing.code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$' then
    raise exception '연결 코드 모양이 맞지 않아요' using errcode = '22023';
  end if;
  if register_pairing.user_id is null
     or char_length(register_pairing.user_id) not between 1 and 100 then
    raise exception '사용자 ID가 비어 있거나 너무 길어요' using errcode = '22023';
  end if;

  insert into public.pairings (code, user_id)
  values (register_pairing.code, register_pairing.user_id)
  on conflict on constraint pairings_pkey do nothing;
  if found then
    return 'registered';
  end if;

  -- 이미 있는 코드: 같은 분이면 괜찮다
  select p.user_id into v_owner
  from public.pairings p
  where p.code = register_pairing.code;
  if v_owner = register_pairing.user_id then
    return 'already';
  end if;
  raise exception '이 연결 코드는 다른 분께 이미 쓰였어요' using errcode = '23505';
end;
$$;

-- 코스 요약 저장 (대기열 kind: 'summary', 인자 summary 는 대기열의 payload)
-- 돌려주는 값:
--   'saved'      저장함
--   'duplicate'  같은 코스(courseId)를 이미 받음. 저장하지 않음 (다시 보내도 괜찮다)
--   'no-pairing' 그분께 살아 있는 연결 코드가 없음. 저장하지 않음
--                (보호자 앱을 연결한 분만 요약을 보낸다. 에러가 아니라서 대기열이 막히지 않는다)
-- 요약 모양이 틀리면 에러 (summary 가 객체가 아님, courseId 없음, 요약의 userId 가 user_id 와 다름)
create or replace function public.push_summary(station_key text, user_id text, summary jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id text;
begin
  perform public.check_station_key(push_summary.station_key);

  if push_summary.summary is null or jsonb_typeof(push_summary.summary) <> 'object' then
    raise exception '요약이 비어 있거나 모양이 맞지 않아요' using errcode = '22023';
  end if;
  v_course_id := push_summary.summary ->> 'courseId';
  if v_course_id is null or char_length(v_course_id) not between 1 and 100 then
    raise exception '요약에 courseId 가 없어요' using errcode = '22023';
  end if;
  if push_summary.user_id is null
     or (push_summary.summary ->> 'userId') is distinct from push_summary.user_id then
    raise exception '요약의 userId 가 보낸 user_id 와 달라요' using errcode = '22023';
  end if;

  -- 살아 있는(끊기지 않은) 연결 코드가 하나도 없으면 저장하지 않는다
  if not exists (
    select 1 from public.pairings p
    where p.user_id = push_summary.user_id
      and p.revoked_at is null
  ) then
    return 'no-pairing';
  end if;

  insert into public.summaries (user_id, course_id, summary)
  values (push_summary.user_id, v_course_id, push_summary.summary)
  on conflict on constraint summaries_pkey do nothing;
  if found then
    return 'saved';
  end if;
  return 'duplicate';
end;
$$;

-- 연결 끊기 (대기열 kind: 'revoke'). 그 코드를 가진 폰은 더 이상 요약을 못 본다.
-- 요약은 지우지 않는다 (같은 분의 다른 연결 코드로는 계속 볼 수 있다).
-- 돌려주는 값: 'revoked' 끊음 / 'already' 이미 끊김 / 'not-found' 없는 코드 (모두 성공으로 본다)
create or replace function public.revoke_pairing(station_key text, code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_station_key(revoke_pairing.station_key);

  update public.pairings p
  set revoked_at = now()
  where p.code = revoke_pairing.code
    and p.revoked_at is null;
  if found then
    return 'revoked';
  end if;

  if exists (select 1 from public.pairings p where p.code = revoke_pairing.code) then
    return 'already';
  end if;
  return 'not-found';
end;
$$;

-- 사용자 지우기 (대기열 kind: 'forget'). 그분의 연결 코드와 요약을 모두 지운다.
-- 돌려주는 값: 'forgotten' (지울 것이 없어도 같다. 다시 보내도 괜찮다)
create or replace function public.forget_user(station_key text, user_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_station_key(forget_user.station_key);

  delete from public.summaries s where s.user_id = forget_user.user_id;
  delete from public.pairings  p where p.user_id = forget_user.user_id;
  return 'forgotten';
end;
$$;


-- ---------------------------------------------------------------------
-- 6. 폰(보호자 앱)이 부르는 함수 1개 (비밀값 없음, 연결 코드로만)
-- ---------------------------------------------------------------------
-- 그 코드에 묶인 분의 요약 목록 (JSON 배열), 최근 코스부터.
--   없는 코드, 끊긴 코드, 아직 등록되지 않은 코드 → 빈 목록 []
--   1년 지난 요약은 빼고 돌려준다 (pg_cron이 안 돌아도 보이지 않게)
create or replace function public.get_summaries(code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(s.summary order by s.summary ->> 'startedAt' desc nulls last, s.created_at desc),
    '[]'::jsonb
  )
  from public.pairings p
  join public.summaries s on s.user_id = p.user_id
  where p.code = get_summaries.code
    and p.revoked_at is null
    and s.created_at >= now() - interval '1 year';
$$;


-- ---------------------------------------------------------------------
-- 7. 함수 실행 권한: 공개 키(anon)는 함수 5개만
-- ---------------------------------------------------------------------
-- 새 함수는 원래 누구나 부를 수 있다. 모두 막고 필요한 것만 연다.
revoke all on function public.check_station_key(text)                from public, anon, authenticated;
revoke all on function public.delete_old_summaries()                 from public, anon, authenticated;
revoke all on function public.register_pairing(text, text, text)     from public, anon, authenticated;
revoke all on function public.push_summary(text, text, jsonb)        from public, anon, authenticated;
revoke all on function public.revoke_pairing(text, text)             from public, anon, authenticated;
revoke all on function public.forget_user(text, text)                from public, anon, authenticated;
revoke all on function public.get_summaries(text)                    from public, anon, authenticated;

grant execute on function public.register_pairing(text, text, text)  to anon;
grant execute on function public.push_summary(text, text, jsonb)     to anon;
grant execute on function public.revoke_pairing(text, text)          to anon;
grant execute on function public.forget_user(text, text)             to anon;
grant execute on function public.get_summaries(text)                 to anon;


-- ---------------------------------------------------------------------
-- 8. 1년 지난 요약 지우기: pg_cron 하루 한 번 (한국 시간 새벽 3시 = UTC 18시)
-- ---------------------------------------------------------------------
-- pg_cron을 켤 수 없으면 안내만 남기고 넘어간다 (나머지는 그대로 만들어진다).
-- 그때는 Supabase 대시보드 → Integrations → Cron 에서 켠 뒤 이 파일을 다시 붙여 넣거나,
-- 가끔 손으로 지운다: select public.delete_old_summaries();
-- 확인: select jobname, schedule, command from cron.job;
do $$
begin
  create extension if not exists pg_cron;
  -- 같은 이름의 예약이 있으면 지우고 다시 만든다 (두 번 붙여 넣어도 하나만 남게)
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'delete-old-summaries';
  perform cron.schedule('delete-old-summaries', '0 18 * * *', 'select public.delete_old_summaries();');
exception when others then
  raise notice 'pg_cron을 켜지 못했어요 (%). 1년 지난 요약은 get_summaries 에서 빠지고, 손으로 지울 수 있어요.', sqlerrm;
end;
$$;
