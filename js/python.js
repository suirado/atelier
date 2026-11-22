/* =========================================================
   Atelier — Python in the browser
   ---------------------------------------------------------
   The materials calculator is written in Python (tools/materials.py),
   the same file you can run on the command line. Here it runs inside
   the page with Pyodide, Python compiled for web pages: loaded once,
   only when someone turns on "Measure", then each calculation takes
   a few milliseconds.
   ========================================================= */

const AtelierPython = (() => {
  const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const SOURCE = "tools/materials.py?v=1";
  let job = null, isReady = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.loadPyodide) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load Python. Are you online?"));
      document.head.append(s);
    });
  }

  // Starts Python and imports materials.py (once per visit)
  function start() {
    return (job ||= (async () => {
      await loadScript(`${PYODIDE}pyodide.js`);
      const [py, code] = await Promise.all([
        loadPyodide({ indexURL: PYODIDE }),
        fetch(SOURCE).then((r) => (r.ok ? r.text() : Promise.reject(new Error("materials.py is missing")))),
      ]);
      py.FS.writeFile("/home/pyodide/materials.py", code);
      py.runPython("import sys, json\nsys.path.insert(0, '/home/pyodide')\nimport materials");
      isReady = true;
      return py;
    })().catch((err) => { job = null; throw err; }));
  }

  // Calls materials.<fn>(data) in Python and gives back what it returns
  async function call(fn, data) {
    const py = await start();
    py.globals.set("_atelier_input", JSON.stringify(data));
    const out = py.runPython(`json.dumps(materials.${fn}(json.loads(_atelier_input)))`);
    return JSON.parse(out);
  }

  return {
    start,
    get ready() { return isReady; },
    // Paint, floor and skirting for every room of a project (Projects.exportData shape)
    materials: (data) => call("calculate", data),
    // The same result as lines of text
    report: (result) => call("report_lines", result),
  };
})();
