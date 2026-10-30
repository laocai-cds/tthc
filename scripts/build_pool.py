#!/usr/bin/env python3
"""Gom tin RSS của báo chính thống thành news/pool.json cho các site Đảng bộ xã/phường Lào Cai.

Định dạng đầu ra (khớp với khối "Tin tức địa phương" trên các site):
  {"updatedAt": ISO, "partial": bool, "items": [
     {"title","url","desc","published","source","img"?,"bad"?}]}

Chỉ dùng thư viện chuẩn của Python. Chạy bằng GitHub Actions mỗi 30 phút.
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "news", "pool.json")
UNITS = json.load(open(os.path.join(ROOT, "scripts", "units.json"), encoding="utf-8"))

UA = "Mozilla/5.0 (compatible; LaoCaiNewsPool/1.0; +https://laocai-cds.github.io/tthc/)"
KEEP_DAYS = 30
MAX_ITEMS = 1500
TIMEOUT = 20

# Nguồn RSS trực tiếp: (tên hiển thị, [feed thử lần lượt], trang chủ để tự dò link RSS)
DIRECT = [
    ("Báo Lào Cai", ["https://baolaocai.vn/rss/home.rss", "https://baolaocai.vn/rss/tin-moi-nhat.rss"], "https://baolaocai.vn/"),
    ("Cổng TTĐT tỉnh Lào Cai", [], "https://laocai.gov.vn/"),
    ("Báo Nhân Dân", ["https://nhandan.vn/rss/home.rss"], "https://nhandan.vn/"),
    ("VOV", ["https://vov.vn/rss/home.rss"], "https://vov.vn/"),
    ("VietnamPlus", ["https://www.vietnamplus.vn/rss/news.rss"], "https://www.vietnamplus.vn/"),
    ("Báo Tin tức (TTXVN)", ["https://baotintuc.vn/rss/home.rss"], "https://baotintuc.vn/"),
    ("Báo Chính phủ", [], "https://baochinhphu.vn/"),
    ("Báo Dân tộc và Miền núi", [], "https://baodantoc.vn/"),
    ("VnExpress", ["https://vnexpress.net/rss/tin-moi-nhat.rss"], None),
    ("Tuổi Trẻ", ["https://tuoitre.vn/rss/tin-moi-nhat.rss"], None),
    ("Thanh Niên", ["https://thanhnien.vn/rss/home.rss"], None),
    ("Dân trí", ["https://dantri.com.vn/rss/home.rss"], None),
    ("Báo Lao Động", ["https://laodong.vn/rss/home.rss"], None),
]

# Tên báo (khớp một phần, không phân biệt hoa thường) được nhận từ Google News RSS.
# Chỉ gồm báo, đài, cổng thông tin chính thống có giấy phép của nhà nước.
ALLOWED_PUBLISHERS = [
    "báo lào cai", "lào cai", "báo yên bái", "yên bái", "nhân dân", "vov", "đài tiếng nói việt nam",
    "vietnamplus", "vietnam+", "ttxvn", "thông tấn xã", "báo tin tức", "tin tức tv", "quân đội nhân dân",
    "báo chính phủ", "chính phủ", "dân tộc và miền núi", "tuổi trẻ", "thanh niên", "dân trí", "vnexpress",
    "lao động", "tiền phong", "pháp luật", "người lao động", "kinh tế & đô thị", "kinh tế và đô thị",
    "nông nghiệp", "tạp chí cộng sản", "đại biểu nhân dân", "đảng cộng sản việt nam", "vtv", "vtc",
    "truyền hình nhân dân", "công an nhân dân", "báo xây dựng", "báo công thương", "báo tài nguyên",
    "báo giáo dục", "giáo dục và thời đại", "sức khỏe & đời sống", "quốc hội",
]

# Tin tiêu cực (vi phạm pháp luật, tai nạn, thiên tai, tội phạm...) bị gắn bad=true
# để các site ẩn đi (cờ RSS_PRAISE_ONLY).
BAD_RE = re.compile(
    r"(khởi tố|bắt giữ|bắt tạm giam|tạm giữ|truy tố|xét xử|tuyên án|án tù|vi phạm|xử phạt|ma túy|ma tuý|"
    r"đánh bạc|cờ bạc|lừa đảo|lừa gạt|chiếm đoạt|trộm cắp|cướp|giết|sát hại|hiếp dâm|xâm hại|bạo hành|"
    r"đâm|chém|ẩu đả|đánh nhau|ném đá|tai nạn|va chạm giao thông|tử vong|thiệt mạng|đuối nước|"
    r"cháy|nổ|sập|sạt lở|lũ quét|lũ lụt|ngập lụt|thiệt hại|thiên tai|bão|động đất|rét hại|"
    r"dịch bệnh|ngộ độc|tham nhũng|tiêu cực|sai phạm|kỷ luật|bị bắt|đối tượng|hung thủ|nghi phạm|"
    r"khai quật tử thi|mất tích|tự tử|tự sát|buôn lậu|hàng giả|hàng lậu|phá rừng|khai thác trái phép)",
    re.IGNORECASE,
)

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}


def http_get(url, accept="*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept, "Accept-Language": "vi,en;q=0.5"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        raw = r.read()
        enc = r.headers.get_content_charset() or "utf-8"
    try:
        return raw.decode(enc, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def clean_text(s):
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        d = None
    if d is None:
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone(timedelta(hours=7)))
    return d.astimezone(timezone.utc)


def txt(el, path):
    x = el.find(path, NS)
    return x.text.strip() if x is not None and x.text else ""


def first_img(item, raw_desc):
    for tag in ("media:content", "media:thumbnail"):
        for m in item.findall(tag, NS):
            u = m.get("url") or ""
            t = m.get("type") or ""
            if u.startswith("https://") and (not t or t.startswith("image")):
                return u
    for m in item.findall("enclosure"):
        u = m.get("url") or ""
        if u.startswith("https://") and (m.get("type") or "image").startswith("image"):
            return u
    blob = (raw_desc or "") + " " + txt(item, "content:encoded")
    m = re.search(r"<img[^>]+src=[\"'](https://[^\"']+)[\"']", html.unescape(blob), re.I)
    return m.group(1) if m else ""


def parse_feed(xml_text, label):
    xml_text = re.sub(r"^﻿", "", xml_text.strip())
    root = ET.fromstring(xml_text.encode("utf-8"))
    out = []
    items = root.findall(".//item") or root.findall(".//atom:entry", NS)
    for it in items:
        title = clean_text(txt(it, "title"))
        link = txt(it, "link")
        if not link:
            a = it.find("atom:link", NS)
            link = a.get("href", "") if a is not None else ""
        raw_desc = txt(it, "description") or txt(it, "atom:summary") or txt(it, "content:encoded")
        desc = clean_text(raw_desc)
        pub = parse_date(txt(it, "pubDate") or txt(it, "atom:published") or txt(it, "atom:updated") or txt(it, "{http://purl.org/dc/elements/1.1/}date"))
        if not title or not link or not pub:
            continue
        src_el = it.find("source")
        source = clean_text(src_el.text) if src_el is not None and src_el.text else label
        out.append({"title": title, "url": link.strip(), "desc": desc, "published": pub, "source": source,
                    "img": first_img(it, raw_desc)})
    return out


def discover_feeds(home):
    try:
        page = http_get(home, "text/html")
    except Exception:
        return []
    found = []
    for m in re.finditer(r"<link[^>]+type=[\"']application/(?:rss|atom)\+xml[\"'][^>]*>", page, re.I):
        h = re.search(r"href=[\"']([^\"']+)[\"']", m.group(0))
        if h:
            found.append(urllib.parse.urljoin(home, html.unescape(h.group(1))))
    for m in re.finditer(r"href=[\"']([^\"']*rss[^\"']*\.(?:rss|xml)|[^\"']*/rss/[^\"']*home[^\"']*)[\"']", page, re.I):
        found.append(urllib.parse.urljoin(home, html.unescape(m.group(1))))
    seen, res = set(), []
    for u in found:
        if u not in seen:
            seen.add(u)
            res.append(u)
    return res[:6]


def fetch_direct():
    items, failed = [], 0
    for label, feeds, home in DIRECT:
        got, tried = [], list(feeds)
        ok = False
        for attempt in range(2):
            for f in tried:
                try:
                    got = parse_feed(http_get(f, "application/rss+xml,application/xml,text/xml,*/*"), label)
                    ok = ok or bool(got)
                    if got:
                        break
                except Exception as e:
                    print(f"  ! {label}: {f}: {e}", file=sys.stderr)
            if got or not home or attempt == 1:
                break
            tried = discover_feeds(home)
            print(f"  ~ {label}: tự dò được {len(tried)} feed", file=sys.stderr)
        if got:
            print(f"  + {label}: {len(got)} bài")
            items += got
        else:
            failed += 1
            print(f"  - {label}: không lấy được", file=sys.stderr)
    return items, failed


def gnews_url(q):
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": q, "hl": "vi", "gl": "VN", "ceid": "VN:vi"})


def allowed(source):
    s = (source or "").lower()
    return any(k in s for k in ALLOWED_PUBLISHERS)


def fetch_gnews():
    """Truy vấn Google News RSS cho tỉnh và từng xã, phường; giữ lại bài của báo chính thống."""
    queries = ['"Lào Cai" when:7d'] + [f'"{u}" "Lào Cai" when:30d' for u in UNITS]
    items, failed = [], 0
    for q in queries:
        try:
            got = parse_feed(http_get(gnews_url(q), "application/rss+xml,*/*"), "Google News")
        except Exception as e:
            failed += 1
            print(f"  ! gnews {q}: {e}", file=sys.stderr)
            time.sleep(1.0)
            continue
        for g in got:
            # Tiêu đề Google News có dạng "Tiêu đề - Tên báo": bỏ phần đuôi.
            suf = " - " + g["source"]
            if g["title"].endswith(suf):
                g["title"] = g["title"][: -len(suf)].strip()
            g["desc"] = ""  # mô tả của Google News chỉ là danh sách liên kết
            g["img"] = ""
            if allowed(g["source"]):
                items.append(g)
        time.sleep(0.4)
    print(f"  + Google News: {len(items)} bài hợp lệ, {failed}/{len(queries)} truy vấn lỗi")
    return items, failed, len(queries)


def norm_key(s):
    return re.sub(r"[^\w]+", " ", (s or "").lower()).strip()


def main():
    now = datetime.now(timezone.utc)
    print("Gom tin trực tiếp từ các báo…")
    direct, d_failed = fetch_direct()
    print("Gom tin qua Google News…")
    gn, g_failed, g_total = fetch_gnews()

    # Giữ bài cũ trong KEEP_DAYS ngày để dữ liệu không bị hụt khi một nguồn tạm lỗi.
    old = []
    try:
        for i in json.load(open(OUT, encoding="utf-8")).get("items", []):
            d = parse_date(i.get("published"))
            if d:
                i["published"] = d
                old.append(i)
    except Exception:
        pass

    seen_u, seen_t, merged = set(), set(), []
    horizon = now - timedelta(days=KEEP_DAYS)
    limit = now + timedelta(days=1)
    # Bài mới được ưu tiên trước bài cũ khi trùng (bài mới có thể có ảnh, mô tả tốt hơn).
    for i in direct + gn + old:
        d = i["published"]
        if d < horizon or d > limit:
            continue
        ku = re.sub(r"[#?].*$", "", i["url"]).rstrip("/").lower()
        kt = norm_key(i["title"])
        if len(i["title"]) < 10 or ku in seen_u or kt in seen_t:
            continue
        if not re.match(r"^https?://\S+$", i["url"]):
            continue
        seen_u.add(ku)
        seen_t.add(kt)
        merged.append(i)

    merged.sort(key=lambda x: x["published"], reverse=True)
    merged = merged[:MAX_ITEMS]

    items = []
    for i in merged:
        o = {
            "title": i["title"],
            "url": i["url"],
            "desc": (i.get("desc") or "")[:400],
            "published": i["published"].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": i.get("source") or "",
        }
        if (i.get("img") or "").startswith("https://"):
            o["img"] = i["img"]
        if BAD_RE.search(i["title"] + " " + (i.get("desc") or "")[:220]) or i.get("bad"):
            o["bad"] = True
        items.append(o)

    if not direct and not gn and not old:
        print("Không lấy được bài nào và chưa có dữ liệu cũ; giữ nguyên file.", file=sys.stderr)
        return 1

    partial = d_failed > 0 or g_failed > g_total * 0.2
    pool = {"updatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "partial": partial, "items": items}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(pool, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    print(f"Đã ghi {len(items)} bài ({sum(1 for x in items if x.get('bad'))} bài bị gắn bad) → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
