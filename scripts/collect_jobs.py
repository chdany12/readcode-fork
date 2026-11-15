"""Collect entry-level BACKEND job postings, ranked by company prestige regardless of scrapability.

Companies with a public job API are scraped (title, url, description). Companies without one
get link-only placeholder slots (description null) pointing to a filtered careers search, to be
filled in manually.

Usage: python3 scripts/collect_jobs.py [N] > backend_jobs.json
"""
import html, json, re, subprocess, sys, urllib.parse

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
PER_COMPANY = 3
TOP_CAP = 5          # cap for the top-tier names
TOP_TIER = {"Google", "Amazon", "Meta", "Microsoft", "Apple"}
MANUAL_SLOTS = 3     # placeholder slots for link-only companies (TOP_CAP for top tier)

# (name, source, board or manual search URL) in prestige order
COMPANIES = [
    ("Google", "google", None),
    ("Amazon", "amazon", None),
    ("Meta", "static", "meta"),
    ("Microsoft", "static", "microsoft"),
    ("Apple", "apple", None),
    ("Netflix", "netflix", None),
    ("NVIDIA", "workday", "nvidia.wd5/nvidia/NVIDIAExternalCareerSite"),
    ("OpenAI", "ashby", "openai"),
    ("Anthropic", "greenhouse", "anthropic"),
    ("Stripe", "greenhouse", "stripe"),
    ("Databricks", "greenhouse", "databricks"),
    ("Uber", "static", "uber"),
    ("Airbnb", "greenhouse", "airbnb"),
    ("Palantir", "lever", "palantir"),
    ("Snowflake", "ashby", "snowflake"),
    ("Shopify", "shopify", None),
    ("Salesforce", "workday", "salesforce.wd12/salesforce/External_Career_Site"),
    ("Bloomberg", "static", "bloomberg"),
    ("Coinbase", "greenhouse", "coinbase"),
    ("Cloudflare", "greenhouse", "cloudflare"),
    ("Datadog", "greenhouse", "datadog"),
    ("Atlassian", "atlassian", None),
    ("Figma", "greenhouse", "figma"),
    ("Notion", "ashby", "notion"),
    ("Ramp", "ashby", "ramp"),
    ("Plaid", "ashby", "plaid"),
    ("Robinhood", "greenhouse", "robinhood"),
    ("DoorDash", "greenhouse", "doordashusa"),
    ("Roblox", "greenhouse", "roblox"),
    ("Dropbox", "greenhouse", "dropbox"),
    ("Pinterest", "greenhouse", "pinterest"),
    ("Reddit", "greenhouse", "reddit"),
    ("Lyft", "greenhouse", "lyft"),
    ("Instacart", "greenhouse", "instacart"),
    ("Twilio", "greenhouse", "twilio"),
    ("MongoDB", "greenhouse", "mongodb"),
    ("Wealthsimple", "ashby", "wealthsimple"),
    ("Clio", "workday", "clio.wd3/clio/ClioCareerSite"),
    ("Discord", "greenhouse", "discord"),
    ("Brex", "greenhouse", "brex"),
    ("Affirm", "greenhouse", "affirm"),
    ("Samsara", "greenhouse", "samsara"),
    ("GitLab", "greenhouse", "gitlab"),
    ("Elastic", "greenhouse", "elastic"),
    ("Okta", "greenhouse", "okta"),
    ("Asana", "greenhouse", "asana"),
    ("Vercel", "greenhouse", "vercel"),
    ("Supabase", "ashby", "supabase"),
    ("Hootsuite", "greenhouse", "hootsuite"),
    ("Toast", "greenhouse", "toast"),
    ("Gusto", "greenhouse", "gusto"),
    ("Chime", "greenhouse", "chime"),
]

# Sites that block scripted access (JS-rendered / auth-walled). Specific postings found via web
# search; descriptions must be filled in manually. (title, location, url)
STATIC = {
    "meta": [
        ("Software Engineer, Infrastructure", "Zurich / London", "https://www.metacareers.com/profile/job_details/1277398403727586/"),
        ("Software Engineer, Product", "London, UK", "https://www.metacareers.com/profile/job_details/612870871828801/"),
        ("Software Engineer, Product", None, "https://www.metacareers.com/profile/job_details/9657291271065759/"),
        ("Software Engineer, Product", None, "https://www.metacareers.com/profile/job_details/1981788412485869/"),
        ("Production Engineer", None, "https://www.metacareers.com/profile/job_details/1512065736047495/"),
    ],
    "microsoft": [
        ("Software Engineer II - Backend", "Redmond, WA", "https://careers.microsoft.com/us/en/job/1435153/Software-Engineer-II-Backend"),
    ],
    "uber": [
        ("Software Engineer I", "New York City, US", "https://jobs.uber.com/en/jobs/300823/"),
        ("Software Engineer I", "Sunnyvale, US", "https://jobs.uber.com/en/jobs/300623/"),
        ("Software Engineer I", "Sunnyvale, CA", "https://www.uber.com/global/en/careers/list/158074/"),
    ],
    "bloomberg": [
        ("2025 Software Engineer", "New York", "https://bloomberg.avature.net/careers/JobDetail/2025-Software-Engineer-New-York/6961"),
    ],
}

# Title must say backend explicitly, or be a generic SWE/SDE title (generalist, server-side heavy).
BACKEND = re.compile(r"(back[- ]?end|server[- ]side|\bapi\b|\bplatform\b|infrastructure|distributed|payments|ledger|money movement)", re.I)
GENERIC = re.compile(r"^\W*(\[\d{4}\]\s*)?(software (development |dev )?engineers?|software developers?|sde|member of technical staff)\b", re.I)
EXCLUDE = re.compile(
    r"(\bintern\b|internship|stagiaire|co-?op|front[- ]?end|full[- ]?stack|\bios\b|android|mobile|\bweb\b|\bux\b|\bui\b|design|"
    r"\bml\b|machine learning|\bai\b|ai-native|inference|model|gpu|cuda|compiler|kernel|"
    r"security|privacy|fraud|abuse|devops|\bsre\b|reliability|network|hardware|embedded|firmware|robotics|"
    r"physical|silicon|asic|verification|c\+\+|data engineer|data scientist|analytics|research|phd|"
    r"test|qa\b|solutions|forward deployed|support|sales|manager|director|recruit|it systems|"
    r"blockchain|web3|crypto|game|\bengine\b|graphics|performance|account|representative|specialist|advocate|associate general|counsel|assistant|\bav\b|autonomy|technical services|nvlink)", re.I)
ROLE = re.compile(r"(engineer|developer|\bsde\b|member of technical staff)", re.I)
SENIOR = re.compile(r"\b(senior|sr\.?|staff|principal|lead|architect|head|distinguished|fellow|"
                    r"ii|iii|iv|2|3|4|5|6|l[4-9]|e[4-9]|ic[3-9])\b", re.I)
ENTRY = re.compile(r"(new grad|graduate|university|entry|junior|early career|associate|"
                   r"engineer,? i\b|engineer[- ]1\b|sde[- ]?i\b|sde[- ]?1\b|\bl3\b|\be3\b|level 1|-i\b)", re.I)


def curl(url, data=None):
    cmd = ["curl", "-sfL", "--max-time", "60", "-A", "Mozilla/5.0 job-collector", url]
    if data is not None:
        cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(data)]
    return json.loads(subprocess.run(cmd, capture_output=True, check=True).stdout)


def clean(s):
    s = html.unescape(s or "")
    s = re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "- ", s, flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"\n\s*\n+", "\n\n", s).strip()


def classify(title):
    t = title.strip()
    if not ROLE.search(t) or EXCLUDE.search(t) or not (BACKEND.search(t) or GENERIC.search(t)):
        return None
    if re.search(r"\b(senior|sr\.?|staff|principal|lead)\b", t, re.I):
        return None
    if ENTRY.search(t):
        return 0
    if SENIOR.search(t):
        return None
    return 1


def listing(source, board):
    """Yield (title, location, url, describe) where describe() lazily fetches the description."""
    if source == "greenhouse":
        for j in curl(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true")["jobs"]:
            yield j["title"], (j.get("location") or {}).get("name"), j["absolute_url"], (lambda j=j: clean(j.get("content")))
    elif source == "lever":
        for j in curl(f"https://api.lever.co/v0/postings/{board}?mode=json"):
            def d(j=j):
                parts = [clean(j.get("description"))] + [f"{l['text']}\n{clean(l['content'])}" for l in j.get("lists", [])] + [clean(j.get("additional"))]
                return "\n\n".join(p for p in parts if p)
            yield j["text"], j.get("categories", {}).get("location"), j["hostedUrl"], d
    elif source == "ashby":
        for j in curl(f"https://api.ashbyhq.com/posting-api/job-board/{board}")["jobs"]:
            yield j["title"], j.get("location"), j["jobUrl"], (lambda j=j: (j.get("descriptionPlain") or clean(j.get("descriptionHtml"))).strip())
    elif source == "amazon":
        seen = set()
        for q in ["software development engineer I", "software development engineer new grad", "backend software development engineer"]:
            u = "https://www.amazon.jobs/en/search.json?" + urllib.parse.urlencode(
                {"base_query": q, "result_limit": 100, "category[]": "software-development"}, doseq=True)
            for j in curl(u).get("jobs", []):
                if j["id_icims"] in seen:
                    continue
                seen.add(j["id_icims"])
                def d(j=j):
                    return "\n\n".join([clean(j.get("description")),
                                        "BASIC QUALIFICATIONS\n" + clean(j.get("basic_qualifications")),
                                        "PREFERRED QUALIFICATIONS\n" + clean(j.get("preferred_qualifications"))])
                yield j["title"], j.get("normalized_location") or j.get("location"), "https://www.amazon.jobs" + j["job_path"], d
    elif source == "netflix":
        base = "https://explore.jobs.netflix.net/api/apply/v2/jobs"
        seen = set()
        for q in ["software engineer", "backend"]:
            for start in range(0, 200, 10):
                pos = curl(f"{base}?domain=netflix.com&query={urllib.parse.quote(q)}&start={start}&num=10").get("positions", [])
                for p in pos:
                    if p["id"] in seen:
                        continue
                    seen.add(p["id"])
                    def d(p=p):
                        return clean(p.get("job_description") or curl(f"{base}/{p['id']}?domain=netflix.com").get("job_description"))
                    yield p["name"], p.get("location"), p["canonicalPositionUrl"], d
                if len(pos) < 10:
                    break
    elif source == "workday":
        host, tenant, site = board.split("/")
        api = f"https://{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}"
        seen = set()
        for q in ["backend software engineer", "software engineer new grad", "software engineer"]:
            for off in range(0, 200, 20):
                posts = curl(f"{api}/jobs", {"limit": 20, "offset": off, "searchText": q, "appliedFacets": {}}).get("jobPostings", [])
                for p in posts:
                    if "externalPath" not in p or p["externalPath"] in seen:
                        continue
                    seen.add(p["externalPath"])
                    def d(p=p):
                        return clean(curl(f"{api}{p['externalPath']}")["jobPostingInfo"].get("jobDescription"))
                    yield p["title"], p.get("locationsText"), f"https://{host}.myworkdayjobs.com/en-US/{site}{p['externalPath']}", d
                if len(posts) < 20:
                    break
    elif source == "apple":
        seen = set()
        for q in ["backend", "software engineer"]:
            for page in range(1, 6):
                res = curl("https://jobs.apple.com/api/v1/search",
                           {"query": q, "filters": {}, "page": page, "locale": "en-us", "sort": "relevance",
                            "format": {"longDate": "MMMM D, YYYY", "mediumDate": "MMM D, YYYY"}})
                rows = res.get("res", {}).get("searchResults", [])
                for r in rows:
                    pid = r.get("positionId")
                    if pid in seen:
                        continue
                    seen.add(pid)
                    url = f"https://jobs.apple.com/en-us/details/{pid}/{r.get('transformedPostingTitle', '')}"
                    def d(url=url):
                        s = subprocess.run(["curl", "-sfL", "--max-time", "60", "-A", "Mozilla/5.0 Chrome/120", url],
                                           capture_output=True).stdout.decode("utf-8", "replace")
                        m = re.search(r'window\.__staticRouterHydrationData = JSON\.parse\((".*?")\);', s, re.S)
                        jd = json.loads(json.loads(m.group(1)))["loaderData"]["jobDetails"]["jobsData"]
                        parts = [("Summary", jd.get("jobSummary")), ("Description", jd.get("description")),
                                 ("Minimum Qualifications", jd.get("minimumQualifications")),
                                 ("Preferred Qualifications", jd.get("preferredQualifications"))]
                        return "\n\n".join(f"{h}\n{clean(v)}" for h, v in parts if v)
                    locs = ", ".join(l.get("name", "") for l in r.get("locations", []) if isinstance(l, dict))
                    yield r.get("postingTitle", ""), locs or None, url, d
                if not rows:
                    break
    elif source == "shopify":
        # Shopify posts evergreen role pages (e.g. "Software Engineers").
        A = "Mozilla/5.0 Chrome/120"
        seen = set()
        for q in ["backend engineer", "software engineer", "infrastructure engineer"]:
            s = subprocess.run(["curl", "-sfL", "--max-time", "60", "-A", A,
                                "https://www.shopify.com/careers/search?" + urllib.parse.urlencode({"keywords": q})],
                               capture_output=True).stdout.decode("utf-8", "replace")
            for slug in dict.fromkeys(re.findall(r"careers/([a-z0-9-]+_[0-9a-f-]{36})", s)):
                if slug in seen:
                    continue
                seen.add(slug)
                url = "https://www.shopify.com/careers/" + slug
                def d(url=url):
                    h = subprocess.run(["curl", "-sfL", "--max-time", "60", "-A", A, url],
                                       capture_output=True).stdout.decode("utf-8", "replace")
                    h = re.sub(r"(?s)<(script|style|svg|noscript)[^>]*>.*?</\1>", "", h)
                    t = clean(h)
                    i = t.find("Apply now")
                    j = t.find("Applying to Shopify")
                    return t[i + 9 if i >= 0 else 0: j if j > 0 else None].strip()[:8000]
                title = slug.split("_")[0].replace("-", " ").title()
                yield title, None, url, d
    elif source == "atlassian":
        for j in curl("https://www.atlassian.com/endpoint/careers/listings"):
            desc = "\n\n".join(clean(j.get(k)) for k in ("overview", "responsibilities", "qualifications") if j.get(k))
            locs = j.get("locations")
            locs = ", ".join(locs) if isinstance(locs, list) else locs
            url = f"https://www.atlassian.com/company/careers/details/{j['id']}"
            yield j.get("title", ""), locs, url, (lambda desc=desc: desc)
    elif source == "google":
        # Server-rendered search pages; posting pages contain the full description.
        base = "https://www.google.com/about/careers/applications/jobs/results/"
        seen = set()
        for q in ["backend software engineer", "software engineer early career", "software engineer"]:
            for page in range(1, 6):
                cmd = ["curl", "-sfL", "--max-time", "60", "-A", "Mozilla/5.0",
                       base + "?" + urllib.parse.urlencode({"q": q, "target_level": "EARLY", "page": page})]
                page_html = subprocess.run(cmd, capture_output=True).stdout.decode("utf-8", "replace")
                ids = list(dict.fromkeys(re.findall(r"jobs/results/(\d{10,}-[a-z0-9-]+)", page_html)))
                for slug in ids:
                    if slug in seen:
                        continue
                    seen.add(slug)
                    url = base + slug
                    def d(url=url):
                        s = subprocess.run(["curl", "-sfL", "--max-time", "60", "-A", "Mozilla/5.0", url],
                                           capture_output=True).stdout.decode("utf-8", "replace")
                        i = s.find("Minimum qualifications")
                        if i < 0:
                            return None
                        text = clean(s[i:i + 20000])
                        end = text.find("Google is proud to be an equal opportunity")
                        return (text[:end] if end > 0 else text[:8000]).strip()
                    title = re.sub(r"^\d+-", "", slug).replace("-", " ").title()
                    yield title, None, url, d
                if not ids:
                    break


def main():
    picked = []
    for name, source, board in COMPANIES:
        cap = TOP_CAP if name in TOP_TIER else PER_COMPANY
        if source == "static":
            for title, loc, url in STATIC[board]:
                picked.append({"company": name, "title": title, "location": loc, "url": url,
                               "level_signal": "explicit-entry" if ENTRY.search(title) else "unlevelled",
                               "description": None, "scraped": False,
                               "note": "site blocks scraping: open the url and paste the description"})
            print(f"{name}: {len(STATIC[board])} static", file=sys.stderr)
        elif source == "manual":
            for _ in range(cap if name in TOP_TIER else MANUAL_SLOTS):
                picked.append({"company": name, "title": None, "location": None, "url": board,
                               "level_signal": None, "description": None, "scraped": False,
                               "note": "link-only: pick an entry-level backend posting from this search and fill title/url/description"})
            print(f"{name}: manual slots", file=sys.stderr)
        else:
            try:
                cands, seen = [], set()
                for title, loc, url, describe in listing(source, board):
                    # Google: "Software Engineer II" is the entry level (L3)
                    lvl = classify(re.sub(r"\bIi\b|\bII\b", "I", title) if source == "google" else title)
                    if lvl is None:
                        continue
                    key = re.sub(r"\s*[-–—,(].*$", "", title.lower()).strip() + "|0" if lvl == 0 else title.lower().strip()
                    if key in seen:
                        continue
                    seen.add(key)
                    cands.append((lvl, title.strip(), loc, url, describe))
                cands.sort(key=lambda c: c[0])
                for lvl, title, loc, url, describe in cands[:cap]:
                    try:
                        desc = describe() or None
                    except Exception:
                        desc = None
                    picked.append({"company": name, "title": title, "location": loc, "url": url,
                                   "level_signal": "explicit-entry" if lvl == 0 else "unlevelled",
                                   "description": desc, "scraped": bool(desc)})
                print(f"{name}: {len(cands)} candidates, took {min(len(cands), cap)}", file=sys.stderr)
            except Exception as e:
                print(f"! {name}: {e}", file=sys.stderr)
        if len(picked) >= N:
            break
    picked = picked[:N]
    json.dump([{"rank": i, **p} for i, p in enumerate(picked, 1)], sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
