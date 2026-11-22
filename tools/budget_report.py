"""
Atelier budget report

The planner shows one total. Before buying, you want to know more:
which room costs the most, where the money goes, and whether the same kind
of piece exists for less. This script reads a project file and writes that
report, both on screen and in a text file you can keep or print.

How to use it:
  1. In the planner open Shopping and click "Project file".
  2. Put the downloaded file in this tools folder.
  3. python budget_report.py "My home project.json"
     python budget_report.py "My home project.json" 3000     (with a budget limit in euros)

The cheaper-swap ideas come from data/catalog.json (made by export_catalog.js).
Without it, the report simply leaves that part out.
"""

import sys
import json

CATALOG_FILE = "data/catalog.json"
BAR_WIDTH = 30
SIMILAR_SIZE = 0.8        # a swap must be at least 80% as wide as the original


def euros(amount):
    return f"{amount:,.2f} EUR".replace(",", " ")


def bar(part, whole):
    """A text bar like ######.... showing part of the whole."""
    if whole == 0:
        return ""
    filled = round(part / whole * BAR_WIDTH)
    return "#" * filled + "." * (BAR_WIDTH - filled)


def add_to(totals, key, amount):
    totals[key] = totals.get(key, 0) + amount


def sorted_by_value(totals):
    """[(amount, name), ...] from the biggest amount to the smallest."""
    pairs = []
    for name, amount in totals.items():
        pairs.append((amount, name))
    pairs.sort(reverse=True)
    return pairs


def load_catalog():
    try:
        with open(CATALOG_FILE, encoding="utf-8") as f:
            return json.load(f)["products"]
    except FileNotFoundError:
        return []


def cheaper_swaps(bought, catalog):
    """For each product, the cheapest one of the same kind in the catalogue.
    bought: {product id: (name, kind, price, how many, width in cm)}"""
    swaps = []
    for pid, (name, kind, price, qty, width) in bought.items():
        best = None
        for other in catalog:
            if other["kind"] != kind or other["id"] == pid or other["own"] or other["structure"]:
                continue
            if other["w"] < width * SIMILAR_SIZE:     # a much smaller piece is not a real swap
                continue
            if other["price"] < price and (best is None or other["price"] < best["price"]):
                best = other
        if best is not None:
            saving = (price - best["price"]) * qty
            swaps.append((saving, name, best["name"], best["product"], qty))
    swaps.sort(reverse=True)
    return swaps


def build_report(data, catalog, limit):
    lines = []
    per_room = {}
    per_category = {}
    bought = {}
    pieces = []

    for p in data["placed"]:
        if p["price"] <= 0:                    # your own decor, doors and windows
            continue
        add_to(per_room, p["room"] or "Outside the rooms", p["price"])
        add_to(per_category, p["category"], p["price"])
        pieces.append((p["price"], p["name"], p["room"]))
        if p["id"] in bought:
            name, kind, price, qty, width = bought[p["id"]]
            bought[p["id"]] = (name, kind, price, qty + 1, width)
        else:
            bought[p["id"]] = (p["name"], p["kind"], p["price"], 1, p["w"])

    total = sum(per_room.values())
    lines.append(f"BUDGET REPORT: {data['project']}")
    lines.append(f"Exported {data['exported']}, prices in {data['currency']}")
    lines.append("=" * 60)
    lines.append(f"Total: {euros(total)} for {len(pieces)} pieces")
    if limit > 0:
        if total <= limit:
            lines.append(f"Within your budget of {euros(limit)}: {euros(limit - total)} left")
        else:
            lines.append(f"OVER your budget of {euros(limit)} by {euros(total - limit)}")
    if total == 0:
        lines.append("\nNothing to buy yet: add some furniture in the planner.")
        return lines

    lines.append("\nBy room")
    for amount, room in sorted_by_value(per_room):
        share = round(amount / total * 100)
        lines.append(f"  {room:<20} {bar(amount, total)} {share:>3}%  {euros(amount):>14}")

    lines.append("\nBy category")
    for amount, category in sorted_by_value(per_category):
        share = round(amount / total * 100)
        lines.append(f"  {category:<20} {bar(amount, total)} {share:>3}%  {euros(amount):>14}")

    lines.append("\nThe 3 most expensive pieces")
    pieces.sort(reverse=True)
    for price, name, room in pieces[:3]:
        lines.append(f"  {euros(price):>14}  {name} ({room or 'no room'})")

    if catalog:
        swaps = cheaper_swaps(bought, catalog)
        lines.append("\nSame kind of piece, for less")
        if not swaps:
            lines.append("  You already picked the cheapest of each kind.")
        saved = 0
        for saving, name, other, other_product, qty in swaps[:5]:
            times = f" x{qty}" if qty > 1 else ""
            lines.append(f"  {name}{times} -> {other} ({other_product}): save {euros(saving)}")
            saved += saving
        if saved > 0:
            lines.append(f"  Doing all of these would save {euros(saved)} ({round(saved / total * 100)}%).")
    return lines


def main():
    if len(sys.argv) < 2:
        print('Usage: python budget_report.py "My home project.json" [budget in euros]')
        sys.exit(2)

    limit = 0
    if len(sys.argv) > 2:
        try:
            limit = float(sys.argv[2])
        except ValueError:
            print(f"The budget must be a number, like 3000 (not {sys.argv[2]}).")
            sys.exit(2)

    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Can't find {sys.argv[1]}. Is it in this folder?")
        sys.exit(2)
    except json.JSONDecodeError:
        print(f"{sys.argv[1]} is not a project file from Atelier.")
        sys.exit(2)
    if "placed" not in data:
        print("This file is from an older version. Download the project file again.")
        sys.exit(2)

    lines = build_report(data, load_catalog(), limit)
    for line in lines:
        print(line)

    out_name = f"{data['project']} budget report.txt"
    with open(out_name, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"\nSaved to {out_name}")


if __name__ == "__main__":
    main()
