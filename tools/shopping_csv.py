"""
Atelier shopping list -> CSV spreadsheet

In the planner, open the Shopping tab and click "Project file".
Then run:

    python shopping_csv.py "My home shopping list.json"

It writes "My home shopping list.csv" next to it (opens in Excel, LibreOffice
or Google Sheets) and prints a summary per store.

Parts marked GIVEN read and write files. Everything marked YOUR TURN uses only
what PCEP covers: variables, strings, lists, dictionaries, loops, if,
functions and try/except.
"""

import sys
import json


# ---------------------------------------------------------------- GIVEN
def read_list(path):
    """Read the file exported by the planner and return it as a dictionary."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_text(path, text):
    """Write text to a file. utf-8-sig lets Excel show accents (ä, é) correctly."""
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write(text)


# ------------------------------------------------------------ YOUR TURN
def csv_cell(value):
    """
    Turn one value into a CSV cell (a string).

    Rules of the CSV format:
      - numbers become text: 649 -> "649", 8.97 -> "8.97"
      - if the text contains a comma, a double quote or a line break,
        wrap it in double quotes, and write every " inside it as ""
        e.g.  KIVIK 3-seat sofa, beige   ->   "KIVIK 3-seat sofa, beige"
              19" frame                  ->   "19"" frame"
      - otherwise leave it as it is

    Hint: str(), the `in` operator, str.replace()
    """
    # TODO
    return str(value)


def csv_line(values):
    """
    Turn a list of values into one CSV line: the cells joined by commas.
    ["KIVIK", 1, 649]  ->  "KIVIK,1,649"

    Hint: a loop (or a list comprehension) calling csv_cell, then ",".join()
    """
    # TODO
    return ""


def item_total(item):
    """
    The price of one line: quantity x unit price, rounded to 2 decimals.
    {"qty": 3, "unit_price": 2.99}  ->  8.97

    If qty or unit_price is missing or isn't a number, return 0.0
    instead of crashing. Hint: try / except (KeyError, TypeError)
    """
    # TODO
    return 0.0


def totals_by_store(items):
    """
    Add up the money spent in each store.
    Returns a dictionary, e.g. {"IKEA": 1923.5, "Leroy Merlin": 89.9}

    Hint: start from an empty dict; for each item use item["store"]
    as the key and add item_total(item) to it (dict.get(key, 0) helps).
    Round each store's total to 2 decimals at the end (floats add up
    to things like 1655.9699999999998).
    """
    # TODO
    return {}


def make_csv(data):
    """
    Build the whole CSV text from the exported dictionary.

    First line (the header):
        Name,Product,Category,Store,Qty,Unit price (EUR),Total (EUR),Link
    Then one line per item, in that order.
    Last line: an empty cell in every column except
        Unit price -> "TOTAL"   and   Total -> the sum of all lines,
        rounded to 2 decimals.

    Join the lines with "\\n".
    """
    # TODO
    return ""


def print_summary(data):
    """
    Print something like this in the terminal:

        Living room (12 pieces)
          IKEA ............  1923.50 EUR
          Leroy Merlin ....    89.90 EUR
          ---------------------------
          Total               2013.40 EUR

    The number of pieces is the sum of every item's qty.
    Hint: f-strings can align numbers: f"{amount:>9.2f}"
    """
    # TODO
    print(data["project"])


# ---------------------------------------------------------------- GIVEN
def main():
    if len(sys.argv) != 2:
        print('Usage: python shopping_csv.py "My home shopping list.json"')
        return
    path = sys.argv[1]
    try:
        data = read_list(path)
    except FileNotFoundError:
        print("File not found:", path)
        return
    except ValueError:
        print("That file isn't a shopping list exported from Atelier.")
        return

    out = path[:-5] + ".csv" if path.endswith(".json") else path + ".csv"
    save_text(out, make_csv(data))
    print_summary(data)
    print("Saved", out)


if __name__ == "__main__":
    main()
