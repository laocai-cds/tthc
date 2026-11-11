#!/usr/bin/env python3
"""Gom tin RSS của báo chính thống thành news/pool.json cho các site Đảng bộ xã/phường Lào Cai.

Định dạng đầu ra (khớp với khối "Tin tức địa phương" trên các site):
  {"updatedAt": ISO, "partial": bool, "items": [
     {"title","url","desc","published","source","img"?,"bad"?}]}

Chỉ dùng thư viện chuẩn của Python. Chạy bằng GitHub Actions mỗi 30 phút.
"""
import html
from collections import Counter
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
KEEP_DAYS = 365
MAX_ITEMS = 10000  # đã nâng từ 6000 để thêm nguồn mới mà không đẩy tin cũ trong năm ra ngoài
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
    # Trang trại Việt: chuyên trang của Báo Nông thôn Ngày nay/Dân Việt (Trung ương Hội Nông dân Việt Nam).
    # Chưa biết chắc địa chỉ RSS nên thử vài địa chỉ thường gặp rồi tự dò từ trang chủ.
    ("Trang trại Việt (Dân Việt)", ["https://trangtraiviet.danviet.vn/rss/home.rss",
                                    "https://trangtraiviet.danviet.vn/rss/trang-trai-viet.rss"],
     "https://trangtraiviet.danviet.vn/"),
]

# Báo, đài, cổng thông tin chính thống có giấy phép của nhà nước. Khớp ĐÚNG tên (không phân biệt hoa thường),
# không khớp một phần, để tránh lọt trang không phải cơ quan báo chí. Nguồn RSS trực tiếp ở DIRECT tự được tính.
ALLOWED_NAMES = {
    "báo lào cai", "báo lào cai điện tử", "cổng thông tin điện tử tỉnh lào cai", "báo yên bái", "báo yên bái điện tử",
    "báo nhân dân", "báo nhân dân điện tử", "nhân dân", "vov", "vov.vn", "vov giao thông", "vov1", "vov2", "vov3",
    "cổng thông tin đài tiếng nói việt nam", "đài tiếng nói việt nam",
    "vietnamplus", "vietnam+ (vietnamplus)", "vietnam+", "thông tấn xã việt nam", "ttxvn", "báo tin tức",
    "báo tin tức và dân tộc", "báo ảnh dân tộc và miền núi", "báo dân tộc và miền núi", "báo chính phủ",
    "báo quân đội nhân dân", "quân đội nhân dân", "công an nhân dân", "báo công an nhân dân",
    "tuổi trẻ", "báo tuổi trẻ", "thanh niên", "báo thanh niên", "dân trí", "báo dân trí", "vnexpress", "báo vnexpress",
    "lao động", "báo lao động", "tiền phong", "báo tiền phong", "báo pháp luật việt nam", "pháp luật việt nam",
    "báo nông nghiệp và môi trường", "nông nghiệp và môi trường", "báo xây dựng", "báo công thương",
    "báo sức khỏe & đời sống", "sức khỏe & đời sống", "báo đại biểu nhân dân", "đại biểu nhân dân",
    "báo bảo vệ pháp luật", "vtv.vn", "vtvgo", "vtv", "vtc news", "báo giáo dục và thời đại", "giáo dục và thời đại",
    "dân việt", "báo dân việt", "báo nông thôn ngày nay", "báo nông thôn ngày nay/dân việt", "trang trại việt",
    "tạp chí cộng sản", "báo điện tử đảng cộng sản việt nam", "kinh tế & đô thị", "báo kinh tế và đô thị",
    # Bổ sung: báo, đài có giấy phép của nhà nước hay xuất hiện trên Google News khi viết về Lào Cai
    "đài phát thanh và truyền hình lào cai", "đài phát thanh - truyền hình lào cai", "truyền hình lào cai",
    "báo biên phòng", "báo điện tử chính phủ", "báo điện tử vov", "vov.vn", "báo văn hóa", "báo văn hoá",
    "báo thể thao & văn hóa", "báo điện tử tiếng nói việt nam", "báo thanh tra", "báo công lý",
    "báo tài nguyên và môi trường", "báo ảnh việt nam",
}

# Nguồn tuỳ chọn: tự dò RSS từ trang chủ, KHÔNG tính vào số nguồn lỗi (partial) nếu không lấy được.
OPTIONAL_DIRECT = [
    ("Báo Quân đội nhân dân", [], "https://www.qdnd.vn/"),
    ("Báo Nông nghiệp và Môi trường", [], "https://nongnghiepmoitruong.vn/"),
    ("Báo Tiền Phong", [], "https://tienphong.vn/"),
    ("Báo Pháp Luật Việt Nam", [], "https://baophapluat.vn/"),
    ("Báo Đại biểu Nhân dân", [], "https://daibieunhandan.vn/"),
    ("Báo Công Thương", [], "https://congthuong.vn/"),
    ("Báo Xây dựng", [], "https://baoxaydung.vn/"),
    ("Báo Giáo dục và Thời đại", [], "https://giaoducthoidai.vn/"),
    ("Báo Dân Việt", [], "https://danviet.vn/"),
    ("Báo Công an nhân dân", [], "https://cand.vn/"),
    ("Báo Biên phòng", [], "https://bienphongvietnam.vn/"),
    ("Tạp chí Cộng sản", [], "https://tapchicongsan.org.vn/"),
]

# Chuyên mục riêng cho từng xã, phường trên Báo Lào Cai: baolaocai.vn/dia-phuong/<slug>/<id>.html
# (slug = tên đơn vị bỏ dấu; "xã Nậm Chày" là id 114, id 71 là xã Nậm Chảy nên không dùng)
BLC_BASE = "https://baolaocai.vn"
BLC_IDS = {
    "xa-khao-mang": 14, "xa-mu-cang-chai": 15, "xa-pung-luong": 16, "xa-tu-le": 17, "xa-tram-tau": 18,
    "xa-hanh-phuc": 19, "xa-phinh-ho": 20, "xa-lien-son": 21, "xa-gia-hoi": 22, "xa-son-luong": 23,
    "xa-van-chan": 24, "xa-thuong-bang-la": 25, "xa-chan-thinh": 26, "xa-nghia-tam": 27, "xa-phong-du-ha": 28,
    "xa-chau-que": 29, "xa-lam-giang": 30, "xa-dong-cuong": 31, "xa-tan-hop": 32, "xa-mau-a": 33,
    "xa-xuan-ai": 34, "xa-mo-vang": 35, "xa-lam-thuong": 36, "xa-luc-yen": 37, "xa-tan-linh": 38,
    "xa-khanh-hoa": 39, "xa-phuc-loi": 40, "xa-muong-lai": 41, "xa-cam-nhan": 42, "xa-yen-thanh": 43,
    "xa-thac-ba": 44, "xa-yen-binh": 45, "xa-bao-ai": 46, "xa-tran-yen": 47, "xa-hung-khanh": 48,
    "xa-luong-thinh": 49, "xa-viet-hong": 50, "xa-quy-mong": 51, "xa-coc-san": 52, "xa-hop-thanh": 53,
    "xa-phong-hai": 54, "xa-xuan-quang": 55, "xa-bao-thang": 56, "xa-tang-loong": 57, "xa-gia-phu": 58,
    "xa-muong-hum": 59, "xa-den-sang": 60, "xa-y-ty": 61, "xa-a-mu-sung": 62, "xa-trinh-tuong": 63,
    "xa-nam-chay": 114, "xa-ban-xeo": 112, "xa-bat-xat": 64, "xa-vo-lao": 65, "xa-khanh-yen": 66,
    "xa-van-ban": 67, "xa-duong-quy": 68, "xa-chieng-ken": 69, "xa-minh-luong": 70, "xa-bao-yen": 72,
    "xa-nghia-do": 73, "xa-thuong-ha": 74, "xa-xuan-hoa": 75, "xa-phuc-khanh": 76, "xa-bao-ha": 77,
    "xa-muong-bo": 78, "xa-ban-ho": 79, "xa-ta-van": 80, "xa-ta-phin": 81, "xa-coc-lau": 82,
    "xa-bao-nhai": 83, "xa-ban-lien": 84, "xa-bac-ha": 85, "xa-ta-cu-ty": 86, "xa-lung-phinh": 87,
    "xa-pha-long": 88, "xa-muong-khuong": 89, "xa-ban-lau": 90, "xa-cao-son": 91, "xa-si-ma-cai": 92,
    "xa-sin-cheng": 93, "xa-ngu-chi-son": 95, "xa-che-tao": 96, "xa-lao-chai": 97, "xa-nam-co": 98,
    "xa-ta-xi-lang": 99, "xa-cat-thinh": 100, "xa-phong-du-thuong": 101, "xa-nam-xe": 94,
    "phuong-nghia-lo": 102, "phuong-trung-tam": 103, "phuong-cau-thia": 104, "phuong-van-phu": 105,
    "phuong-yen-bai": 106, "phuong-nam-cuong": 107, "phuong-au-lau": 108, "phuong-cam-duong": 109,
    "phuong-lao-cai": 110, "phuong-sa-pa": 111,
}
BLC_MAX_NEW_PER_RUN = 700   # số bài mới tối đa lấy chi tiết (ngày, ảnh, mô tả) mỗi lần chạy; phần còn lại để lần sau


def norm_name(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower())


# Tin tiêu cực (vi phạm pháp luật, tai nạn, thiên tai, tội phạm...) bị gắn bad=true
# để các site ẩn đi (cờ RSS_PRAISE_ONLY).
BAD_RE = re.compile(
    r"(?<!\w)(khởi tố|bắt giữ|bắt tạm giam|tạm giữ|truy tố|xét xử|tuyên án|án tù|vi phạm|xử phạt|ma túy|ma tuý|"
    r"đánh bạc|cờ bạc|lừa đảo|lừa gạt|chiếm đoạt|trộm cắp|cướp|giết|sát hại|hiếp dâm|xâm hại|bạo hành|"
    r"đâm|chém|ẩu đả|đánh nhau|ném đá|tai nạn|va chạm giao thông|tử vong|thiệt mạng|đuối nước|"
    r"cháy|nổ|sập|sạt lở|lũ quét|lũ lụt|ngập lụt|thiệt hại|thiên tai|bão|động đất|rét hại|"
    r"dịch bệnh|ngộ độc|tham nhũng|tiêu cực|sai phạm|kỷ luật|bị bắt|hung thủ|nghi phạm|"
    r"khai quật tử thi|mất tích|tự tử|tự sát|buôn lậu|hàng giả|hàng lậu|phá rừng|mưa đá|dông lốc|lốc xoáy|mất trắng|đánh bạn|vào cuộc điều tra|công an vào cuộc|bị thương|thương vong|sụt lún|đứt gãy|sương muối|băng giá|hạn hán|ô nhiễm|dịch tả|sốt xuất huyết|ngập úng|vỡ đập|cứu hộ|cứu nạn|bạo lực|quấy rối|khiếu kiện|biểu tình|bức xúc|đình chỉ|xuống cấp|hư hỏng|ùn tắc|kẹt xe|thất thoát|nợ đọng|chậm tiến độ|tín dụng đen|cho vay nặng lãi|mại dâm|tàng trữ|lạm quyền|trộm|khai thác trái phép)(?!\w)",
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
    return decode_body(raw, enc)


def decode_body(raw, enc="utf-8"):
    """Giải nén gzip (nhiều báo tự nén dù không được yêu cầu) rồi đổi sang chữ."""
    import zlib
    if raw[:2] == b"\x1f\x8b":
        try:
            raw = zlib.decompressobj(16 + zlib.MAX_WBITS).decompress(raw)
        except Exception:
            pass
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


def fetch_direct(sources=None, count_failed=True):
    items, failed = [], 0
    for label, feeds, home in (DIRECT if sources is None else sources):
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
            failed += 1 if count_failed else 0
            print(f"  - {label}: không lấy được", file=sys.stderr)
    return items, failed


# ---------- Chuyên mục từng xã, phường của Báo Lào Cai ----------
def _meta(page, key):
    """Giá trị thẻ meta (property hoặc name = key), không phụ thuộc thứ tự thuộc tính."""
    for m in re.finditer(r"<meta\b[^>]*>", page, re.I):
        tag = m.group(0)
        k = re.search(r'(?:property|name)=["\']([^"\']+)["\']', tag, re.I)
        if k and k.group(1).lower() == key.lower():
            c = re.search(r'content=["\']([^"\']*)["\']', tag, re.I)
            if c:
                return html.unescape(c.group(1)).strip()
    return ""


def _blc_list_page(unit, url):
    """Lấy danh sách bài từ trang chuyên mục của một xã/phường. Trả về danh sách (tiêu đề, url, ngày hoặc None)."""
    page = http_get(url, "text/html")
    # Nếu trang có khai báo RSS thì dùng luôn.
    rss = re.search(r"<link[^>]+type=[\"']application/(?:rss|atom)\+xml[\"'][^>]*href=[\"']([^\"']+)[\"']", page, re.I)
    if rss:
        try:
            return [(g["title"], g["url"], g["published"], g.get("desc", ""), g.get("img", ""))
                    for g in parse_feed(http_get(urllib.parse.urljoin(url, html.unescape(rss.group(1)))), "Báo Lào Cai")]
        except Exception:
            pass
    out, seen = [], set()
    for m in re.finditer(r"<a\b[^>]*href=[\"']([^\"']*-post\d+\.html)[\"'][^>]*>(.*?)</a>", page, re.I | re.S):
        href = urllib.parse.urljoin(url, html.unescape(m.group(1)))
        if href in seen:
            continue
        tag = m.group(0)
        t = re.search(r'title=["\']([^"\']{12,})["\']', tag, re.I)
        title = clean_text(t.group(1)) if t else clean_text(m.group(2))
        if len(title) < 12:
            continue
        seen.add(href)
        pub = None  # ngày đăng lấy từ trang bài viết (ngày ở trang danh sách dễ lẫn giữa các bài)
        out.append((title, href, pub, "", ""))
    return out


def _blc_detail(item):
    """Bổ sung ngày đăng, mô tả, ảnh từ trang bài viết (thẻ meta). Trả về True nếu có ngày đăng."""
    try:
        page, final = fetch_page_head(item["url"])
    except Exception as e:
        print(f"  ! chi tiết {item['url']}: {e}", file=sys.stderr)
        return False
    pub = parse_date(_meta(page, "article:published_time") or _meta(page, "pubdate") or _meta(page, "date"))
    if pub and not item.get("published"):
        item["published"] = pub
    if not item.get("desc"):
        item["desc"] = clean_text(_meta(page, "og:description") or _meta(page, "description"))
    if not item.get("img"):
        item["img"] = og_image(page, final)
    return bool(item.get("published"))


def fetch_blc_sections(known_pub):
    """Gom tin từ chuyên mục riêng của từng xã, phường trên Báo Lào Cai (báo chính thống của tỉnh).
    Mỗi bài gắn nhãn 'us' = đơn vị tương ứng để site hiển thị đúng xã."""
    from concurrent.futures import ThreadPoolExecutor
    targets = [(u, f"{BLC_BASE}/dia-phuong/{slug(u)}/{BLC_IDS[slug(u)]}.html") for u in UNITS if slug(u) in BLC_IDS]
    found, failed = {}, 0

    def one(t):
        u, url = t
        for attempt in range(2):
            try:
                return u, _blc_list_page(u, url)
            except Exception as e:
                print(f"  ! chuyên mục {u}: {e}", file=sys.stderr)
                time.sleep(2.0)
        return u, None

    with ThreadPoolExecutor(max_workers=4) as ex:
        for u, rows in ex.map(one, targets):
            if rows is None:
                failed += 1
                continue
            for title, href, pub, desc, img in rows:
                k = re.sub(r"[#?].*$", "", href).rstrip("/").lower()
                it = found.setdefault(k, {"title": title, "url": href, "desc": desc, "published": pub,
                                          "source": "Báo Lào Cai", "img": img, "us": []})
                if u not in it["us"]:
                    it["us"].append(u)
    items = list(found.values())
    # Bài đã có trong pool: dùng lại ngày đăng cũ (chỉ cần gắn nhãn xã). Bài mới: lấy ngày, mô tả, ảnh từ trang bài viết.
    need = []
    for i in items:
        k = re.sub(r"[#?].*$", "", i["url"]).rstrip("/").lower()
        if k in known_pub:
            i["published"] = known_pub[k]
        elif not i["published"]:
            need.append(i)
    need = need[:BLC_MAX_NEW_PER_RUN]
    if need:
        with ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(_blc_detail, need))
    items = [i for i in items if i["published"]]
    print(f"  + Chuyên mục xã/phường (Báo Lào Cai): {len(items)} bài từ {len(targets)} chuyên mục, {failed} lỗi")
    return items, failed, len(targets)


def gnews_url(q):
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": q, "hl": "vi", "gl": "VN", "ceid": "VN:vi"})


def allowed(source):
    n = norm_name(source)
    return n in ALLOWED_NAMES or n in {norm_name(d[0]) for d in DIRECT}


# Các báo, đài trung ương có giấy phép: truy vấn Google News giới hạn theo trang (site:) cho từng xã, phường.
GN_SITES = " OR ".join("site:" + d for d in (
    "nhandan.vn", "vov.vn", "vietnamplus.vn", "baotintuc.vn", "baodantoc.vn", "baochinhphu.vn", "qdnd.vn",
    "cand.vn", "baophapluat.vn", "nongnghiepmoitruong.vn", "tienphong.vn", "daibieunhandan.vn", "vtv.vn",
    "laodong.vn", "dantri.com.vn", "vnexpress.net", "tuoitre.vn", "thanhnien.vn", "laocai.gov.vn",
    "danviet.vn", "kinhtedothi.vn", "giaoducthoidai.vn", "congthuong.vn", "baoxaydung.vn", "bienphongvietnam.vn"))


def fetch_gnews():
    """Truy vấn Google News RSS cho tỉnh và từng xã, phường; giữ lại bài của báo chính thống."""
    queries = ['"Lào Cai" when:7d',
               'site:trangtraiviet.danviet.vn "Lào Cai" when:365d']  # Trang trại Việt (phòng khi chưa có RSS trực tiếp)
    for u in UNITS:
        bare = re.sub(r"^(xã|phường)\s+", "", u, flags=re.I)
        queries += [
            f'"{u}" "Lào Cai" when:365d',              # đúng tên đơn vị (xã/phường + tên)
            f'"{bare}" "Lào Cai" when:365d',           # chỉ tên riêng, tiêu đề hay bỏ chữ xã/phường
            f'"{bare}" site:baolaocai.vn when:365d',   # riêng Báo Lào Cai, nguồn nhiều tin xã nhất
            f'"{bare}" "Lào Cai" ({GN_SITES}) when:365d',  # các báo, đài trung ương có giấy phép
            f'"{bare}" site:trangtraiviet.danviet.vn when:365d',  # riêng Trang trại Việt (Dân Việt), theo từng xã
        ]
    items, failed = [], 0
    for q in queries:
        got = None
        for attempt in range(2):
            try:
                got = parse_feed(http_get(gnews_url(q), "application/rss+xml,*/*"), "Google News")
                break
            except Exception as e:
                print(f"  ! gnews {q}: {e}", file=sys.stderr)
                time.sleep(3.0)
        if got is None:
            failed += 1
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
        time.sleep(0.5)
    print(f"  + Google News: {len(items)} bài hợp lệ, {failed}/{len(queries)} truy vấn lỗi")
    return items, failed, len(queries)


# Báo chuyên ngành toàn quốc: nguồn trực tiếp lấy cả tin không liên quan Lào Cai, nên luôn lọc theo nội dung.
BROAD_SOURCES = {"trang trại việt", "trang trại việt (dân việt)", "báo dân việt", "dân việt"}


def local_source(source):
    n = norm_name(source)
    return "lào cai" in n or "yên bái" in n


def relevant(i):
    """Bài từ báo ngoài tỉnh chỉ giữ khi nhắc Lào Cai hoặc tên xã, phường (tiêu đề hoặc đầu mô tả)."""
    t = (i.get("title") or "") + " " + (i.get("desc") or "")[:400]
    t = " " + re.sub(r"\s+", " ", t.lower()) + " "
    return "lào cai" in t or any(" " + u.lower() + " " in t.replace(",", " ").replace(".", " ") for u in UNITS)


def norm_key(s):
    return re.sub(r"[^\w]+", " ", (s or "").lower()).strip()


# ---------- Ảnh nhỏ đầu tin ----------
ENRICH_PER_RUN = int(os.environ.get("ENRICH_PER_RUN") or 400)      # số bài xử lý mỗi lần chạy (các bài còn lại để lần sau)
ENRICH_DAYS = 365         # lấy ảnh cho cả bài cũ trong năm (mỗi lần chạy xử lý dần, bài mới trước)
GN_API = "https://news.google.com/_/DotsSplashUi/data/batchexecute"


def gnews_real_url(url):
    """Giải mã liên kết news.google.com/rss/articles/<id> về địa chỉ bài gốc. Trả về '' nếu không được."""
    import base64
    m = re.search(r"news\.google\.com/(?:rss/)?articles/([^?/#]+)", url)
    if not m:
        return ""
    aid = m.group(1)
    try:
        raw = base64.urlsafe_b64decode(aid + "=" * (-len(aid) % 4))
        if raw.startswith(b"\x08\x13\x22"):
            raw = raw[3:]
        if raw.endswith(b"\xd2\x01\x00"):
            raw = raw[:-3]
        n = raw[0]
        body = raw[2:n + 1] if n >= 0x80 else raw[1:n + 1]
        s = body.decode("utf-8", errors="ignore")
        if s.startswith("http"):
            return s
    except Exception:
        pass
    try:  # định dạng mới: hỏi máy chủ Google News
        page = http_get("https://news.google.com/rss/articles/" + aid, "text/html")
        sg = re.search(r'data-n-a-sg="([^"]+)"', page)
        ts = re.search(r'data-n-a-ts="([^"]+)"', page)
        if not (sg and ts):
            return ""
        inner = json.dumps(["garturlreq", [["X", "X", ["X", "X"], None, None, 1, 1, "US:en", None, 1, None, None, None,
                                              None, None, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, None, 0, 0, None, 0],
                            aid, int(ts.group(1)), sg.group(1)], separators=(",", ":"))
        freq = json.dumps([[["Fbv4je", inner, None, "generic"]]], separators=(",", ":"))
        data = urllib.parse.urlencode({"f.req": freq}).encode()
        req = urllib.request.Request(GN_API, data=data, headers={
            "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            resp = r.read().decode("utf-8", errors="replace")
        part = json.loads(resp.split("\n\n")[1])
        real = json.loads(part[0][2])[1]
        return real if isinstance(real, str) and real.startswith("http") else ""
    except Exception as e:
        print(f"  ! giải mã Google News lỗi: {e}", file=sys.stderr)
        return ""


def og_image(page, base):
    """Lấy ảnh đại diện (og:image / twitter:image) từ HTML; chỉ nhận https."""
    for pat in (r'<meta[^>]+(?:property|name)=["\']og:image(?::secure_url|:url)?["\'][^>]*>',
                r'<meta[^>]+(?:property|name)=["\']twitter:image(?::src)?["\'][^>]*>',
                r'<link[^>]+rel=["\']image_src["\'][^>]*>'):
        for m in re.finditer(pat, page, re.I):
            c = re.search(r'(?:content|href)=["\']([^"\']+)["\']', m.group(0), re.I)
            if not c:
                continue
            u = urllib.parse.urljoin(base, html.unescape(c.group(1)).strip())
            if u.startswith("http://"):
                u = "https://" + u[len("http://"):]
            if u.startswith("https://") and len(u) < 600:
                return u
    return ""


BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/124.0 Safari/537.36")
from collections import Counter
STATS = Counter()
META_SAMPLES = {}
DEBUG = []  # lý do lấy ảnh thất bại, ghi ra news/enrich-debug.txt để dễ chẩn đoán


def fetch_page_head(url):
    import http.cookiejar
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    req = urllib.request.Request(url, headers={
        "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.5", "Accept-Encoding": "gzip", "Referer": "https://www.google.com/"})
    with op.open(req, timeout=15) as r:
        ctype = r.headers.get("Content-Type", "")
        if ctype and not re.search(r"html|xml", ctype, re.I):
            raise ValueError("không phải HTML: " + ctype[:30])
        raw = r.read(300_000)
        final = r.geturl()
        enc = r.headers.get_content_charset() or "utf-8"
    return decode_body(raw, enc), final


def enrich_one(item):
    """Bổ sung ảnh (và địa chỉ bài gốc nếu là liên kết Google News). Sửa trực tiếp item."""
    url = item["url"]
    if "news.google.com" in url:
        real = gnews_real_url(url)
        if real:
            item["url"] = url = real
    if "news.google.com" in url:
        item["ni"] = True if not item.get("img") else item.get("ni")
        return
    try:
        page, final = fetch_page_head(url)
        img = og_image(page, final)
        dom = urllib.parse.urlparse(url).netloc
        if not img:
            STATS[(dom, "không có ảnh")] += 1
            DEBUG.append(f"KHÔNG CÓ ẢNH ({len(page)} byte) {url}")
            if dom not in META_SAMPLES:  # mỗi báo một mẫu thẻ meta để chẩn đoán
                tags = re.findall(r"<(?:meta|link)[^>]*(?:image|og:)[^>]*>", page, re.I)[:6]
                META_SAMPLES[dom] = (" ".join(t[:260] for t in tags) if tags else
                                     "(không có thẻ nào) ĐẦU TRANG: " + re.sub(r"\s+", " ", page[:400]))
        else:
            STATS[(dom, "có ảnh")] += 1
    except Exception as e:
        STATS[(urllib.parse.urlparse(url).netloc, "lỗi " + re.sub(r"\s+", " ", str(e))[:50])] += 1
        # Lỗi mạng/bị chặn: thử lại ở các lần chạy sau (tối đa 3 lần), chưa kết luận bài không có ảnh.
        DEBUG.append(f"LỖI {e} {url}")
        item["nf"] = int(item.get("nf") or 0) + 1
        if item["nf"] >= 3:
            item["ni"] = True
        return
    if img:
        item["img"] = img
        item.pop("ni", None)
        item.pop("nf", None)
    else:
        item["ni"] = True


def enrich(items, now):
    from concurrent.futures import ThreadPoolExecutor
    horizon = now - timedelta(days=ENRICH_DAYS)
    todo = [i for i in items
            if not i.get("img") and not i.get("ni") and not i.get("bad") and i["published"] >= horizon]
    todo = todo[:ENRICH_PER_RUN]
    if not todo:
        return
    with ThreadPoolExecutor(max_workers=int(os.environ.get("ENRICH_WORKERS") or 8)) as ex:
        list(ex.map(enrich_one, todo))
    got = sum(1 for i in todo if i.get("img"))
    print(f"  + Ảnh: lấy được {got}/{len(todo)} bài")
    try:
        with open(os.path.join(ROOT, "news", "enrich-debug.txt"), "w", encoding="utf-8") as f:
            lines = [f"Lấy được {got}/{len(todo)} bài", "== THỐNG KÊ THEO BÁO =="]
            lines += [f"{n:5d}  {d}  {k}" for (d, k), n in STATS.most_common(60)]
            lines += ["== MẪU THẺ META (mỗi báo một mẫu) =="] + [f"{d}: {m}" for d, m in META_SAMPLES.items()]
            lines += ["== VÍ DỤ LỖI =="] + DEBUG[:30]
            f.write("\n".join(lines) + "\n")
    except Exception:
        pass


# ---------- File tin riêng cho từng xã, phường (tải nhanh) ----------
UNIT_DIR = os.path.join(ROOT, "news", "units")
UNIT_KEEP = 100  # số bài mới nhất giữ cho mỗi đơn vị (site chỉ hiện 30 bài đầu)


def slug(name):
    import unicodedata
    t = unicodedata.normalize("NFD", name or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D").lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", t))


def _keep(t):
    import unicodedata
    t = unicodedata.normalize("NFC", str(t or "")).lower()
    return " " + re.sub(r"[^\w]+", " ", t).strip() + " "


def _plain(t):
    import unicodedata
    t = unicodedata.normalize("NFD", str(t or ""))
    t = "".join(c for c in t if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D")
    return _keep(t)


def _has_marks(t):
    import unicodedata
    n = unicodedata.normalize("NFD", str(t or ""))
    return bool(re.search(r"[\u0300-\u036f]|[ăâêôơưđ]", n, re.I))


def _mentions(t, ph):
    return (_keep(ph) in _keep(t)) or (not _has_marks(t) and _plain(ph) in _plain(t))


def _head_mention(title, bare):
    import unicodedata
    s = unicodedata.normalize("NFC", str(title or "")).lower()
    s = re.sub(r"^[\s\"'“”‘’\[\(]+", "", s)
    h = unicodedata.normalize("NFC", bare or "").lower()
    if not h:
        return False
    if s.startswith(h) and re.match(r"^\s*[:\-–—]", s[len(h):]):
        return True
    return bool(re.search(r"(^|[^\w])(xã|phường|đảng bộ|đảng ủy|ubnd|hđnd)\s+" + re.escape(h) + r"(?!\w)", s))


def _first_text(i):
    d = i.get("desc") or ""
    first = re.split(r"(?<=[.!?…])\s+", d)[0][:220] if d else ""
    return (i.get("title") or "") + " " + first


# Đơn vị mà tên riêng (không kèm chữ "xã") đủ để nhận diện khi bài đến từ báo địa phương hoặc nhắc "Lào Cai".
# Tiêu đề báo hay viết "ở Xuân Hòa", "Xuân Hòa khẩn trương…", "các xã A, B, Xuân Hòa".
BARE_LOCAL_OK = {"xã Xuân Hòa"}


def _bare_local(i, text, bare):
    t = unicodedata_nfc(text)
    if not re.search(r"(^|[^\w])" + re.escape(bare) + r"(?!\w)", t):  # đúng hoa thường: tên riêng viết hoa
        return False
    return local_source(i.get("source") or "") or "Lào Cai" in t


def unicodedata_nfc(t):
    import unicodedata
    return unicodedata.normalize("NFC", str(t or ""))


def write_unit_files(items, updated_at, partial):
    """Ghi news/units/<xã>.json: tin đã lọc sẵn cho từng xã/phường và cho Tỉnh Lào Cai (khớp quy tắc ở site)."""
    os.makedirs(UNIT_DIR, exist_ok=True)
    shown = [i for i in items if not i.get("bad")]
    shown.sort(key=lambda x: x["published"], reverse=True)
    sources = len({i.get("source") for i in shown})
    texts = [_first_text(i) for i in shown]

    def in_prov(k):
        t = texts[k]
        return bool(re.search(r"Lào Cai|Yên Bái", t, re.I)) or any(_mentions(t, u) for u in UNITS)

    groups = {"Tỉnh Lào Cai": [k for k in range(len(shown)) if in_prov(k)]}
    for u in UNITS:
        bare = re.sub(r"^(xã|phường)\s+", "", u, flags=re.I)
        groups[u] = [k for k, i in enumerate(shown)
                     if u in (i.get("us") or []) or _mentions(texts[k], u) or _head_mention(i.get("title"), bare)
                     or (u in BARE_LOCAL_OK and _bare_local(i, texts[k], bare))]
    written = 0
    for name, idx in groups.items():
        payload = {"partial": partial, "provTotal": len(shown), "provSources": sources,
                   "matchedTotal": len(idx), "items": [shown[k] for k in idx[:UNIT_KEEP]]}
        # dữ liệu ghi ra có ngày dạng chuỗi
        out_items = []
        for i in payload["items"]:
            o = {k: v for k, v in i.items() if k not in ("ni", "nf")}
            o["published"] = i["published"].strftime("%Y-%m-%dT%H:%M:%SZ")
            if name in BARE_LOCAL_OK:  # site lọc lại theo "us", nên gắn nhãn để bài khớp tên riêng không bị loại
                o["us"] = sorted(set((o.get("us") or []) + [name]))
            out_items.append(o)
        payload["items"] = out_items
        path = os.path.join(UNIT_DIR, slug(name) + ".json")
        try:  # chỉ ghi khi nội dung đổi, tránh mỗi 15 phút sửa cả trăm file
            old = json.load(open(path, encoding="utf-8"))
            old_cmp = {k: v for k, v in old.items() if k != "updatedAt"}
            if old_cmp == payload:
                continue
        except Exception:
            pass
        payload["updatedAt"] = updated_at
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        written += 1
    print(f"  + File theo xã: {len(groups)} đơn vị, ghi mới {written} file")


def main():
    now = datetime.now(timezone.utc)
    only_images = os.environ.get("ENRICH_ONLY") == "1"  # chỉ lấy ảnh cho bài đã có, không gom tin mới
    prev_partial = False
    try:
        prev_partial = bool(json.load(open(OUT, encoding="utf-8")).get("partial"))
    except Exception:
        pass
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
    known_pub = {re.sub(r"[#?].*$", "", i["url"]).rstrip("/").lower(): i["published"] for i in old}

    if only_images:
        direct, d_failed, gn, g_failed, g_total = [], 0, [], 0, 0
    else:
        print("Gom tin trực tiếp từ các báo…")
        direct, d_failed = fetch_direct()
        opt, _ = fetch_direct(OPTIONAL_DIRECT, count_failed=False)
        direct += opt
        print("Gom tin từ chuyên mục từng xã, phường của Báo Lào Cai…")
        try:
            blc, blc_failed, blc_total = fetch_blc_sections(known_pub)
        except Exception as e:
            print(f"  ! chuyên mục xã/phường lỗi: {e}", file=sys.stderr)
            blc, blc_failed, blc_total = [], 0, 0
        direct += blc
        print("Gom tin qua Google News…")
        gn, g_failed, g_total = fetch_gnews()

    seen_u, seen_t, merged = set(), set(), []
    by_url, by_title = {}, {}  # url / tiêu đề chuẩn hoá -> bài đã giữ, để gộp nhãn đơn vị 'us' khi trùng
    horizon = now - timedelta(days=KEEP_DAYS)
    limit = now + timedelta(days=1)
    dropped = Counter()
    for i in old + direct + gn:  # bài cũ đứng trước để giữ ảnh/đánh dấu đã lấy được, tránh bản mới (chưa có ảnh) đè lên
        if not allowed(i.get("source")):
            dropped[i.get("source") or "?"] += 1
            continue
        # Bài có mô tả (lấy trực tiếp từ RSS toàn quốc) mà không nhắc Lào Cai/xã/phường thì bỏ.
        if (i.get("desc") or norm_name(i.get("source")) in BROAD_SOURCES) \
                and not local_source(i.get("source")) and not relevant(i):
            dropped["(không liên quan Lào Cai)"] += 1
            continue
        if re.match(r"^\s*từ khóa\s*:", i.get("title") or "", re.I):  # trang thẻ (tag) của báo, không phải bài viết
            continue
        d = i["published"]
        if d < horizon or d > limit:
            continue
        ku = re.sub(r"[#?].*$", "", i["url"]).rstrip("/").lower()
        kt = norm_key(i["title"])
        keep = by_url.get(ku) or by_title.get(kt)
        if keep is not None and i.get("us"):  # bài đã có (cũ hoặc nguồn khác): gộp thêm nhãn xã, phường
            keep["us"] = sorted(set((keep.get("us") or []) + i["us"]))
            if not keep.get("desc") and i.get("desc"):
                keep["desc"] = i["desc"]
            if not keep.get("img") and i.get("img"):
                keep["img"] = i["img"]
        if len(i["title"]) < 10 or ku in seen_u or kt in seen_t:
            continue
        if not re.match(r"^https?://\S+$", i["url"]):
            continue
        seen_u.add(ku)
        seen_t.add(kt)
        by_url[ku] = i
        by_title[kt] = i
        merged.append(i)

    if dropped:
        print("  Bỏ vì không thuộc danh sách báo chính thống:", dict(dropped.most_common(12)))
    merged.sort(key=lambda x: x["published"], reverse=True)
    merged = merged[:MAX_ITEMS]

    for i in merged:  # gắn cờ tiêu cực trước để khỏi mất công lấy ảnh cho bài sẽ bị ẩn
        if BAD_RE.search(i["title"] + " " + (i.get("desc") or "")[:220]):
            i["bad"] = True
        else:
            i.pop("bad", None)  # tính lại cho cả bài cũ, phòng khi bộ lọc đã được sửa
    print("Lấy ảnh nhỏ đầu tin…")
    enrich(merged, now)
    # Sau khi giải mã liên kết Google News, bài có thể trùng bài của báo gốc: lọc trùng lần nữa.
    seen_u, final = set(), []
    for i in merged:
        ku = re.sub(r"[#?].*$", "", i["url"]).rstrip("/").lower()
        if ku in seen_u:
            continue
        seen_u.add(ku)
        final.append(i)
    merged = final

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
        if i.get("bad"):
            o["bad"] = True
        if i.get("us"):
            o["us"] = sorted(set(i["us"]))  # đơn vị mà chuyên mục báo gán cho bài
        if i.get("ni") and "img" not in o:
            o["ni"] = True  # đã thử lấy ảnh nhưng bài không có ảnh: lần sau khỏi thử lại
        if i.get("nf") and "img" not in o:
            o["nf"] = i["nf"]
        items.append(o)

    if not direct and not gn and not old:
        print("Không lấy được bài nào và chưa có dữ liệu cũ; giữ nguyên file.", file=sys.stderr)
        return 1

    partial = prev_partial if only_images else (d_failed > 0 or g_failed > g_total * 0.2)
    pool = {"updatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "partial": partial, "items": items}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(pool, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    write_unit_files(merged, pool["updatedAt"], partial)
    print(f"Đã ghi {len(items)} bài ({sum(1 for x in items if x.get('bad'))} bài bị gắn bad) → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
