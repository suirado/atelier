"""
Atelier materials calculator

Furniture is only half of a home. Before moving in you also buy paint for the
walls and ceilings, flooring and skirting boards, and the shop asks "how
much?". This script answers that for every room of a plan:

  - walls: area to paint, minus doors and windows, in litres and in cans
  - ceiling: white paint for it
  - floor: area plus the offcuts you lose when cutting (more for
    herringbone and diagonal patterns), in boxes
  - skirting boards: the length around the room minus the doors, in 2.4 m lengths

The same file is used in two places:
  - in the planner: turn on "Measure" and the site runs this code in your
    browser (with Pyodide, Python made for web pages) and shows the results
    on the 3D plan
  - on the command line, with a project file from the planner:
        python materials.py "sample project.json"

Rules of thumb used (written on most paint and flooring packs):
  1 litre of paint covers about 10 m² per coat, and walls need 2 coats.
"""

# ---------- Rules of thumb ----------
PAINT_PER_LITRE = 10          # m² one litre covers, one coat
COATS = 2
CAN_SIZES = [10, 5, 2.5]      # litres, biggest first
SKIRTING_LENGTH = 2.4         # metres per board
SKIRTING_SPARE = 0.05         # 5% extra for corners and cuts
OPENING_GAP = 0.2             # a door or window this close to a wall is in that wall (metres)

# What each floor in the planner is made of: box size in m² and how much is lost when cutting
FLOORS = {
    "oak":        {"kind": "Parquet", "box": 2.2,  "waste": 0.10},
    "walnut":     {"kind": "Parquet", "box": 2.0,  "waste": 0.10},
    "herring":    {"kind": "Parquet", "box": 1.4,  "waste": 0.15},
    "diagonal":   {"kind": "Parquet", "box": 2.0,  "waste": 0.15},
    "tiles":      {"kind": "Tiles",   "box": 1.44, "waste": 0.10},
    "checker":    {"kind": "Tiles",   "box": 1.44, "waste": 0.12},
    "terracotta": {"kind": "Tiles",   "box": 0.96, "waste": 0.10},
    "stone":      {"kind": "Tiles",   "box": 1.0,  "waste": 0.12},
    "terrazzo":   {"kind": "Tiles",   "box": 1.08, "waste": 0.10},
    "carpet":     {"kind": "Carpet",  "box": 1.0,  "waste": 0.05},
    "concrete":   {"kind": "Concrete", "box": 0,   "waste": 0},
}
WET_ROOMS = ["bathroom", "kitchen"]               # these need moisture-resistant paint
OUTDOOR = ["terrace", "balcony", "garden"]


def round_up(value):
    """The whole number just above (or equal to) value: 4.1 -> 5, 4.0 -> 4."""
    whole = int(value)
    if value > whole:
        whole = whole + 1
    return whole


def cans_for(litres):
    """Which cans to buy for this many litres, biggest first: 13 L -> [10, 2.5, 2.5]."""
    cans = []
    left = litres
    for size in CAN_SIZES:
        while left >= size:
            cans.append(size)
            left = left - size
    smallest = CAN_SIZES[-1]
    while left > 0:
        cans.append(smallest)
        left = left - smallest
    # Two of the smallest cans cost more than one of the next size: swap them
    if cans.count(2.5) >= 2:
        cans.remove(2.5)
        cans.remove(2.5)
        cans.append(5)
        cans.sort(reverse=True)
    return cans


def describe_cans(cans):
    """[10, 5, 5] -> '1 × 10 L + 2 × 5 L'"""
    parts = []
    for size in CAN_SIZES:
        count = cans.count(size)
        if count > 0:
            parts.append(f"{count} × {size:g} L")
    if not parts:
        return "none"
    return " + ".join(parts)


def on_room_wall(piece, room):
    """True if a door or window sits in one of this room's four walls."""
    x, y = piece["x"], piece["y"]
    left, top = room["x"], room["y"]
    right, bottom = left + room["w"], top + room["h"]
    along_x = left - OPENING_GAP <= x <= right + OPENING_GAP
    along_y = top - OPENING_GAP <= y <= bottom + OPENING_GAP
    near_top_or_bottom = abs(y - top) < OPENING_GAP or abs(y - bottom) < OPENING_GAP
    near_left_or_right = abs(x - left) < OPENING_GAP or abs(x - right) < OPENING_GAP
    return (near_top_or_bottom and along_x) or (near_left_or_right and along_y)


def is_door(piece):
    return "door" in piece["kind"]


def calculate_room(room, placed):
    """Everything to buy for one room, as a dictionary."""
    w, d, height = room["w"], room["h"], room.get("height", 2.6)
    floor_area = w * d
    perimeter = 2 * (w + d)
    outdoor = room.get("type", "") in OUTDOOR

    # Doors and windows in this room's walls
    openings_area = 0
    door_width = 0
    openings = 0
    for piece in placed:
        if not piece["wall"] or not on_room_wall(piece, room):
            continue
        openings = openings + 1
        openings_area = openings_area + (piece["w"] / 100) * (piece["h"] / 100)
        if is_door(piece):
            door_width = door_width + piece["w"] / 100

    wall_area = perimeter * height
    paint_area = max(0, wall_area - openings_area)
    result = {
        "name": room["name"], "type": room.get("type", ""), "outdoor": outdoor,
        "x": room["x"], "y": room["y"], "w": w, "d": d, "height": height,
        "floor_area": round(floor_area, 2), "perimeter": round(perimeter, 2),
        "wall_area": round(wall_area, 2), "openings": openings,
        "openings_area": round(openings_area, 2),
    }

    # Paint: walls in the room's colour, the ceiling in white (not outside)
    if outdoor:
        result["paint_area"] = 0
        result["paint_litres"] = 0
        result["paint_cans"] = []
        result["ceiling_litres"] = 0
    else:
        litres = round_up(paint_area * COATS / PAINT_PER_LITRE)
        result["paint_area"] = round(paint_area, 2)
        result["paint_litres"] = litres
        result["paint_cans"] = cans_for(litres)
        result["ceiling_litres"] = round_up(floor_area * COATS / PAINT_PER_LITRE)
    if room.get("type", "") in WET_ROOMS:
        result["paint_type"] = "Kitchen & bathroom paint"
    else:
        result["paint_type"] = "Wall paint, matt"
    result["wall_colour"] = room.get("wall", "#FFFFFF")
    result["wall_name"] = room.get("wall_name", result["wall_colour"])

    # Floor
    rule = FLOORS.get(room.get("floor", "oak"), FLOORS["oak"])
    with_waste = floor_area * (1 + rule["waste"])
    boxes = 0
    if rule["box"] > 0:
        boxes = round_up(with_waste / rule["box"])
    result["floor"] = {
        "name": room.get("floor_name", room.get("floor", "")), "kind": rule["kind"],
        "area": round(with_waste, 2), "waste": int(rule["waste"] * 100),
        "boxes": boxes, "box_size": rule["box"],
    }

    # Skirting boards: not in bathrooms (tiles go to the floor) and not outside
    if outdoor or room.get("type", "") == "bathroom":
        result["skirting_m"] = 0
        result["skirting_boards"] = 0
    else:
        length = max(0, perimeter - door_width)
        result["skirting_m"] = round(length, 2)
        result["skirting_boards"] = round_up(length * (1 + SKIRTING_SPARE) / SKIRTING_LENGTH)
    return result


def calculate(project):
    """Rooms and totals for a whole project (the dictionary from the project file)."""
    rooms = []
    for room in project["rooms"]:
        rooms.append(calculate_room(room, project.get("placed", [])))

    # Totals: one line per paint colour and per floor, because that is how you buy them
    paints = {}
    floors = {}
    ceiling = 0
    boards = 0
    floor_area = 0
    for r in rooms:
        floor_area = floor_area + r["floor_area"]
        ceiling = ceiling + r["ceiling_litres"]
        boards = boards + r["skirting_boards"]
        if r["paint_litres"] > 0:
            key = r["wall_name"] + " · " + r["paint_type"]
            if key not in paints:
                paints[key] = {"name": r["wall_name"], "colour": r["wall_colour"], "type": r["paint_type"], "litres": 0, "rooms": []}
            paints[key]["litres"] = paints[key]["litres"] + r["paint_litres"]
            paints[key]["rooms"].append(r["name"])
        f = r["floor"]
        if f["boxes"] > 0:
            if f["name"] not in floors:
                floors[f["name"]] = {"name": f["name"], "kind": f["kind"], "boxes": 0, "area": 0, "rooms": []}
            floors[f["name"]]["boxes"] = floors[f["name"]]["boxes"] + f["boxes"]
            floors[f["name"]]["area"] = round(floors[f["name"]]["area"] + f["area"], 2)
            floors[f["name"]]["rooms"].append(r["name"])

    paint_list = []
    for p in paints.values():
        p["cans"] = cans_for(p["litres"])
        p["cans_text"] = describe_cans(p["cans"])
        paint_list.append(p)
    ceiling_cans = cans_for(ceiling)

    return {
        "project": project.get("project", "My home"),
        "rooms": rooms,
        "totals": {
            "floor_area": round(floor_area, 2),
            "paints": paint_list,
            "ceiling_litres": ceiling,
            "ceiling_cans_text": describe_cans(ceiling_cans),
            "floors": list(floors.values()),
            "skirting_boards": boards,
        },
        "rules": f"1 L covers {PAINT_PER_LITRE} m² per coat, {COATS} coats; skirting in {SKIRTING_LENGTH} m boards",
    }


def report_lines(result):
    """The result as lines of text, for the screen and the .txt file."""
    lines = []
    lines.append(f"MATERIALS: {result['project']}")
    lines.append("=" * 64)
    for r in result["rooms"]:
        lines.append("")
        lines.append(f"{r['name']}  ({r['w']:g} × {r['d']:g} m, {r['height']:g} m high)")
        lines.append(f"  Floor      {r['floor_area']:>7.2f} m²   {r['floor']['name']}: {r['floor']['area']:.2f} m² with {r['floor']['waste']}% for cuts"
                     + (f" = {r['floor']['boxes']} boxes" if r['floor']['boxes'] else ""))
        if r["outdoor"]:
            lines.append("  Walls      outside: nothing to paint")
            continue
        lines.append(f"  Walls      {r['paint_area']:>7.2f} m²   ({r['wall_area']:.2f} m² minus {r['openings']} doors/windows)")
        lines.append(f"  Paint      {r['paint_litres']:>7} L    {r['wall_name']}, {r['paint_type'].lower()}: {describe_cans(r['paint_cans'])}")
        lines.append(f"  Ceiling    {r['ceiling_litres']:>7} L    white")
        if r["skirting_boards"]:
            lines.append(f"  Skirting   {r['skirting_m']:>7.2f} m    {r['skirting_boards']} boards")

    t = result["totals"]
    lines.append("")
    lines.append("SHOPPING LIST")
    lines.append("-" * 64)
    for p in t["paints"]:
        lines.append(f"  Paint {p['name']} ({p['type'].lower()}): {p['litres']} L = {p['cans_text']}")
    if t["ceiling_litres"]:
        lines.append(f"  Ceiling white: {t['ceiling_litres']} L = {t['ceiling_cans_text']}")
    for f in t["floors"]:
        lines.append(f"  {f['kind']} {f['name']}: {f['boxes']} boxes ({f['area']:.2f} m²)")
    if t["skirting_boards"]:
        lines.append(f"  Skirting boards: {t['skirting_boards']} × {SKIRTING_LENGTH} m")
    lines.append("")
    lines.append("Rules of thumb: " + result["rules"] + ". Check the label on what you buy.")
    return lines


# ---------- Command line (not used in the browser) ----------
def main():
    import sys
    import json
    if len(sys.argv) < 2:
        print('Usage: python materials.py "My home project.json"')
        sys.exit(2)
    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            project = json.load(f)
    except FileNotFoundError:
        print(f"Can't find {sys.argv[1]}. Is it in this folder?")
        sys.exit(2)
    except json.JSONDecodeError:
        print(f"{sys.argv[1]} is not a project file from Atelier.")
        sys.exit(2)
    if project.get("version", 1) < 3:
        print("This file is from an older version: room heights and floors are missing.")
        print("Download the project file again from the planner.")
        sys.exit(2)

    lines = report_lines(calculate(project))
    for line in lines:
        print(line)
    out_name = f"{project['project']} materials.txt"
    with open(out_name, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"\nSaved to {out_name}")


if __name__ == "__main__":
    main()
