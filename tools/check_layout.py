"""
Atelier layout checker

The planner lets you put furniture anywhere, which is good for sketching but
means a plan can look fine on screen and still not work in real life: two
pieces overlap a little, a wardrobe sticks into the hallway, or the gap
between the bed and the chest is too narrow to walk through.

This script reads a project file and checks, room by room:

  - pieces that overlap each other
  - pieces that stick out of their room
  - walkways narrower than 60 cm between big pieces
    (60 cm is the usual minimum to pass sideways; 90 cm is comfortable)

Rugs, small decor and things on the wall (pictures, doors, windows) are left
out, because they are meant to sit on, under or in other things.

How to use it:
  1. In the planner open Shopping and click "Project file".
  2. Put the downloaded file in this tools folder.
  3. python check_layout.py "My home project.json"
"""

import sys
import json
import math

MIN_WALKWAY = 0.60        # metres
TOLERANCE = 0.03          # 3 cm: pieces placed exactly side by side are fine

# Pieces big enough that you have to walk around them
BIG_KINDS = ["sofa", "bed", "table", "desk", "wardrobe", "sideboard", "bookcase",
             "chest", "island", "kitchen", "kitchen-base", "tall-fridge", "fridge",
             "tv-bench", "tall-cabinet", "vanity", "bathtub"]

# Seats that are meant to slide under something
SEATS = ["chair", "stool", "bench", "footstool"]
GOES_UNDER = ["table", "desk", "island", "bistro", "coffee-table"]


def tucked_in(a, b):
    """True for a chair under a table, a stool under the island, and so on."""
    return ((a["kind"] in SEATS and b["kind"] in GOES_UNDER)
            or (b["kind"] in SEATS and a["kind"] in GOES_UNDER))


def footprint(piece):
    """The rectangle a piece covers on the floor: (left, top, right, bottom) in metres.
    x and y are the centre; w and d are in cm. A turned piece covers a wider box."""
    w = piece["w"] / 100
    d = piece["d"] / 100
    angle = math.radians(piece["rot"])
    cos_a = abs(math.cos(angle))
    sin_a = abs(math.sin(angle))
    half_w = (w * cos_a + d * sin_a) / 2
    half_d = (w * sin_a + d * cos_a) / 2
    return (piece["x"] - half_w, piece["y"] - half_d, piece["x"] + half_w, piece["y"] + half_d)


def overlap(a, b):
    """How far two rectangles go into each other on x and on y (0 if they don't)."""
    over_x = min(a[2], b[2]) - max(a[0], b[0])
    over_y = min(a[3], b[3]) - max(a[1], b[1])
    return max(0, over_x), max(0, over_y)


def gap(a, b):
    """The free space between two rectangles that face each other, or None
    if they don't face each other (one is diagonal from the other)."""
    over_x, over_y = overlap(a, b)
    if over_x > 0 and over_y == 0:                 # one above the other
        return max(b[1] - a[3], a[1] - b[3])
    if over_y > 0 and over_x == 0:                 # side by side
        return max(b[0] - a[2], a[0] - b[2])
    return None


def inside(rect, room):
    return (rect[0] >= room["x"] - TOLERANCE and rect[1] >= room["y"] - TOLERANCE
            and rect[2] <= room["x"] + room["w"] + TOLERANCE
            and rect[3] <= room["y"] + room["h"] + TOLERANCE)


def cm(metres):
    return f"{round(metres * 100)} cm"


def check_room(room_name, pieces, rooms_by_name):
    """Returns the problems found in one room, as a list of text lines."""
    problems = []
    room = rooms_by_name.get(room_name)

    for p in pieces:
        if room is not None and not inside(footprint(p), room):
            problems.append(f"{p['name']} sticks out of the room")

    for i in range(len(pieces)):
        for j in range(i + 1, len(pieces)):
            a, b = pieces[i], pieces[j]
            ra, rb = footprint(a), footprint(b)
            over_x, over_y = overlap(ra, rb)
            if over_x > TOLERANCE and over_y > TOLERANCE:
                if tucked_in(a, b):
                    continue
                problems.append(f"{a['name']} and {b['name']} overlap by {cm(min(over_x, over_y))}")
                continue
            if a["kind"] in BIG_KINDS and b["kind"] in BIG_KINDS:
                space = gap(ra, rb)
                if space is not None and TOLERANCE < space < MIN_WALKWAY:
                    problems.append(f"only {cm(space)} to walk between {a['name']} and {b['name']}")
    return problems


def main():
    if len(sys.argv) < 2:
        print('Usage: python check_layout.py "My home project.json"')
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

    rooms_by_name = {}
    for room in data["rooms"]:
        rooms_by_name[room["name"]] = room

    # Group the pieces that matter by room, in the order the rooms were drawn
    by_room = {}
    for room in data["rooms"]:
        by_room[room["name"]] = []
    by_room[""] = []                               # pieces outside every room
    for p in data["placed"]:
        if p["rug"] or p["small"] or p["wall"]:
            continue
        by_room.setdefault(p["room"], []).append(p)

    print(f"Layout check: {data['project']}\n")
    total = 0
    for name, pieces in by_room.items():
        if name == "":
            if pieces:
                print(f"Outside every room ({len(pieces)})")
                for p in pieces:
                    print(f"  ! {p['name']} is not in any room")
                total += len(pieces)
            continue
        problems = check_room(name, pieces, rooms_by_name)
        mark = "ok" if not problems else f"{len(problems)} to look at"
        print(f"{name:<20} {len(pieces):>2} pieces   {mark}")
        for line in problems:
            print(f"  ! {line}")
        total += len(problems)

    print()
    if total == 0:
        print("Everything fits, with room to walk.")
    else:
        print(f"{total} thing(s) to look at.")
        sys.exit(1)


if __name__ == "__main__":
    main()
