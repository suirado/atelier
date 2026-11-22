# Atelier tools (Python)

Small command-line scripts that work on data from the site. Plain Python 3, no
packages to install. Run them from this `tools` folder.

| Script | What it does | Input |
|---|---|---|
| `check_catalog.py` | Checks all 105 products before publishing: unique ids, prices, realistic sizes, https links, every 3D model credited, every material has its bump map | `data/catalog.json` |
| `check_layout.py` | Room by room: overlapping furniture, pieces sticking out of a room, walkways under 60 cm | a project file |
| `budget_report.py` | Spending per room and category, the 3 most expensive pieces, cheaper pieces of the same kind and size; saves a `.txt` report | a project file (+ optional budget) |
| `materials.py` | Paint per wall colour (minus doors and windows), ceiling white, flooring in boxes with extra for cuts, skirting boards. **Also runs inside the planner**: the Measure button loads it in the browser with Pyodide and shows the results on the 3D plan | a project file |
| `shopping_csv.py` | Exercise: turns a project's shopping list into a CSV | a project file |
| `check_shopping_csv.py` | Tests the exercise above | — |
| `export_catalog.js` | Writes `data/catalog.json` from `js/catalog.js` (Node) | — |

## Getting a project file

In the planner, open **Shopping** and click **Project file**. Put the downloaded
`.json` in this folder. (**Download PDF** gives the printable shopping list for
the shop; the project file is the one for these scripts.)

`sample project.json` is the "Sunlit" template, exported this way, to try things out.

## Examples

```
python check_catalog.py
python check_layout.py "sample project.json"
python budget_report.py "sample project.json" 12000
python materials.py "sample project.json"
```

Each checker ends with exit code 0 when everything is fine and 1 when it found
something, so they can also be run one after another by another script.
After changing `js/catalog.js`, run `node export_catalog.js` first.
