"""
Checks your functions in shopping_csv.py. Run:

    python check_shopping_csv.py

Each function prints OK or what it got instead. Fix one at a time, top to bottom.
"""

import shopping_csv as s

passed = 0
failed = 0


def check(what, got, expected):
    global passed, failed
    if got == expected:
        passed += 1
        print("  OK   ", what)
    else:
        failed += 1
        print("  FAIL ", what)
        print("         expected:", repr(expected))
        print("         got:     ", repr(got))


print("csv_cell")
check("plain text", s.csv_cell("KIVIK"), "KIVIK")
check("whole number", s.csv_cell(649), "649")
check("decimal", s.csv_cell(8.97), "8.97")
check("comma", s.csv_cell("sofa, beige"), '"sofa, beige"')
check("quote", s.csv_cell('19" frame'), '"19"" frame"')
check("accent", s.csv_cell("SÖDERHAMN"), "SÖDERHAMN")

print("csv_line")
check("three cells", s.csv_line(["KIVIK", 1, 649]), "KIVIK,1,649")
check("cell with comma", s.csv_line(["a, b", "c"]), '"a, b",c')
check("empty cells", s.csv_line(["", "", "x"]), ",,x")

print("item_total")
check("3 x 2.99", s.item_total({"qty": 3, "unit_price": 2.99}), 8.97)
check("2 x 499", s.item_total({"qty": 2, "unit_price": 499}), 998)
check("missing price", s.item_total({"qty": 2}), 0.0)
check("price is text", s.item_total({"qty": 2, "unit_price": "lots"}), 0.0)

data = s.read_list("sample shopping list.json")

print("totals_by_store")
check("sample list", s.totals_by_store(data["items"]), {"IKEA": 1655.97, "Leroy Merlin": 89.9})
check("empty list", s.totals_by_store([]), {})

print("make_csv")
lines = s.make_csv(data).split("\n")
check("number of lines", len(lines), 6)
lines = lines + [""] * (6 - len(lines))   # so a short answer fails instead of crashing
check("header", lines[0], "Name,Product,Category,Store,Qty,Unit price (EUR),Total (EUR),Link")
check("first item", lines[1], '3-seat sofa,"KIVIK 3-seat sofa, Tresund light beige",Living room,IKEA,1,649,649,https://www.ikea.com/fr/fr/p/kivik-canape-3-places-tresund-beige-clair-s89482830/')
check("quote inside", (lines[4].split(",") + [""])[1], '"Pendant ""Globe"" 30 cm')
check("total line", lines[5], ",,,,,TOTAL,1745.87,")

print()
print(passed, "passed,", failed, "failed")
if failed == 0:
    print("All done. Now try print_summary: python shopping_csv.py \"sample shopping list.json\"")
