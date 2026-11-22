"""
Atelier catalogue checker

The site sells nothing itself, but every product shows a price, a size and a
store link, and a wrong number misleads people. With 105 products, checking
by hand before each update is not realistic, so this script does it:

  - every id is unique, every product has a name and a known category
  - prices: bought products cost something (and not a typo like 14999),
    your own decor costs 0
  - sizes in cm are realistic for that kind of furniture
  - store links are secure (https://)
  - every 3D model file is credited in assets/models/CREDITS.txt (CC0 licence)
  - every scanned material has its bump map (name-n.jpg)

Run from the tools folder:

    node export_catalog.js        (only after changing js/catalog.js)
    python check_catalog.py

It prints what is wrong and ends with "All good" or the number of problems.
"""

import os
import sys
import json

CATALOG_FILE = os.path.join("data", "catalog.json")
MODELS_DIR = os.path.join("..", "assets", "models")
MATERIALS_DIR = os.path.join("..", "assets", "materials")

MAX_PRICE = 5000          # euros; anything above is almost surely a typo
MAX_SIZE = 500            # cm; nothing in a home is wider than 5 m

# Realistic footprints for some kinds of furniture: (min width, max width, min depth, max depth) in cm
SIZE_RULES = {
    "sofa": (150, 320, 80, 180),
    "armchair": (60, 110, 60, 110),
    "wing-chair": (60, 110, 70, 110),
    "chair": (35, 65, 40, 65),
    "stool": (30, 60, 30, 60),
    "bed": (90, 220, 190, 230),
    "table": (60, 250, 60, 120),
    "desk": (80, 200, 50, 90),
    "rug": (60, 400, 60, 400),
    "door": (60, 100, 5, 20),
}

problems = []             # every problem found, as text


def report(product_id, message):
    """Remember one problem."""
    problems.append(f"{product_id}: {message}")


def check_ids(products):
    seen = {}
    for p in products:
        pid = p["id"]
        seen[pid] = seen.get(pid, 0) + 1
    for pid, count in seen.items():
        if count > 1:
            report(pid, f"id used {count} times")


def check_text(products, categories):
    for p in products:
        if p["name"].strip() == "":
            report(p["id"], "no name")
        if p["category"] not in categories:
            report(p["id"], f"unknown category '{p['category']}'")


def check_price(p):
    if p["structure"]:                      # doors and windows belong to the room
        return
    if p["own"]:
        if p["price"] != 0:
            report(p["id"], f"own decor should cost 0, not {p['price']}")
        return
    if p["price"] <= 0:
        report(p["id"], "has no price")
    elif p["price"] > MAX_PRICE:
        report(p["id"], f"price {p['price']} looks like a typo")


def check_size(p):
    for side in ("w", "d", "h"):
        value = p[side]
        if value <= 0:
            report(p["id"], f"{side} must be more than 0 cm")
        elif value > MAX_SIZE:
            report(p["id"], f"{side} = {value} cm is more than {MAX_SIZE} cm")
    rule = SIZE_RULES.get(p["kind"])
    if rule is None:
        return
    min_w, max_w, min_d, max_d = rule
    if not (min_w <= p["w"] <= max_w and min_d <= p["d"] <= max_d):
        report(p["id"], f"{p['w']} x {p['d']} cm is unusual for a {p['kind']} "
                        f"(expected {min_w}-{max_w} x {min_d}-{max_d})")


def check_link(p):
    if p["own"] or p["structure"]:
        return
    if not p["url"].startswith("https://"):
        report(p["id"], "store link is missing or not https://")


def check_credits():
    """Every model file must be named in CREDITS.txt."""
    try:
        with open(os.path.join(MODELS_DIR, "CREDITS.txt"), encoding="utf-8") as f:
            credits = f.read()
    except FileNotFoundError:
        report("CREDITS.txt", "file not found")
        return 0
    models = [name for name in os.listdir(MODELS_DIR) if name.endswith(".glb")]
    for name in models:
        if name not in credits:
            report(name, "3D model is not credited in CREDITS.txt")
    return len(models)


def check_materials():
    """Each texture (wood.jpg) needs its bump map (wood-n.jpg)."""
    files = os.listdir(MATERIALS_DIR)
    textures = [name for name in files if name.endswith(".jpg") and not name.endswith("-n.jpg")]
    for name in textures:
        bump = name[:-4] + "-n.jpg"
        if bump not in files:
            report(name, f"material has no bump map {bump}")
    return len(textures)


def main():
    try:
        with open(CATALOG_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("No catalogue found. Run first:  node export_catalog.js")
        sys.exit(2)

    products = data["products"]
    print(f"Checking {len(products)} products (exported {data['exported']})")

    check_ids(products)
    check_text(products, data["categories"])
    for p in products:
        check_price(p)
        check_size(p)
        check_link(p)
    models = check_credits()
    materials = check_materials()
    print(f"Checked {models} 3D models and {materials} materials")

    # A short overview per category
    per_category = {}
    for p in products:
        per_category[p["category"]] = per_category.get(p["category"], 0) + 1
    for category in data["categories"]:
        print(f"  {category:<18} {per_category.get(category, 0):>3} products")

    print()
    if problems:
        for line in problems:
            print("  PROBLEM ", line)
        print(f"\n{len(problems)} problem(s) to fix.")
        sys.exit(1)               # lets other scripts know the check failed
    print("All good: the catalogue is ready to publish.")


if __name__ == "__main__":
    main()
