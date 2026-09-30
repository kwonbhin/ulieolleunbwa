# 언제 만나? 약속 날짜 정하기

이름을 입력하고 되는 날짜를 체크하면, 모두가 가능한 날을 한눈에 보여주는 사이트예요.
GitHub Pages로 올리고 Supabase에 데이터를 저장합니다. 로그인 없이 카톡 링크만으로 참여할 수 있어요.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 |
| `app.js` | 달력, 저장, 실시간 반영 |
| `config.js` | Supabase 주소와 anon key (직접 채우기) |
| `supabase.sql` | 테이블, RLS, 실시간 설정 |

## 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다. (기존 과제 프로젝트와 따로 만드는 걸 추천해요.)
2. 왼쪽 메뉴 **SQL Editor** → **New query**에 `supabase.sql` 내용을 전부 붙여넣고 **Run**.
3. **Project Settings → API**에서 두 값을 복사합니다.
   - Project URL
   - `anon` `public` key
4. `config.js`를 열어 두 값을 붙여넣습니다.

```js
window.MEETUP_CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

> `service_role` key는 절대 넣지 마세요. 이 키는 RLS를 무시하는 관리자 키라 공개되면 DB 전체가 뚫립니다.

## 2. GitHub Pages 배포

1. GitHub에서 새 저장소를 만듭니다. (예: `meetup-calendar`, Public)
2. 네 파일을 저장소 최상위에 올립니다.
   ```bash
   git init
   git add .
   git commit -m "약속 날짜 정하기 사이트"
   git branch -M main
   git remote add origin https://github.com/kwonbhin/meetup-calendar.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages**에서 Source를 **Deploy from a branch**, Branch를 **main / (root)** 로 저장.
4. 1~2분 뒤 `https://kwonbhin.github.io/meetup-calendar/` 에서 열립니다.

## 3. 사용하기

1. 사이트에 들어가 약속 이름을 쓰고 **약속 만들기**를 누르면 `?e=xxxxxxxxxx`가 붙은 주소로 이동합니다.
2. **링크 복사**를 눌러 카톡 단톡방에 보냅니다.
3. 친구들은 이름을 입력하고 되는 날짜를 누르면 자동 저장됩니다.
4. 색이 진할수록 많이 되는 날, 분홍 별은 전원 가능한 날입니다.

약속마다 새 링크가 생기니 다음 모임 때도 같은 사이트에서 새로 만들면 돼요.

## 보안 메모

로그인 없는 사이트라서 설계상 한계가 있어요.

- 약속 링크를 아는 사람은 누구나 다른 사람의 이름으로 체크하거나 응답을 지울 수 있습니다. 친구끼리 쓰는 용도라 허용한 부분이에요.
- 약속 ID는 10자리 무작위 값이라 링크를 모르면 찾아내기 어렵지만, RLS 정책상 anon key로 전체 목록 조회는 가능합니다. 민감한 정보는 약속 이름에 쓰지 마세요.
- 이름 길이(20자), 제목 길이(40자), 날짜 개수(400개)는 DB의 CHECK 제약으로 막아 두었습니다.

더 막고 싶다면 Supabase Auth의 익명 로그인(Anonymous Sign-in)을 켜고 `responses`에 `user_id` 열을 추가해, `update`/`delete` 정책을 `auth.uid() = user_id`로 좁히는 방법이 있어요.
