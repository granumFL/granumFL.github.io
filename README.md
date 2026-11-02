# GranumFL website

Static site (no build step): `index.html`, `style.css`, `app.js`, `sim.js`, `img/`.

- Preview: `python3 -m http.server 8812` in this folder, then open http://localhost:8812.
- Hero: `sim.js` is a real-time 2D toy (double-density-relaxation water, contact grains, drag and
  buoyancy coupling) of a saturated debris column released behind a gate. It is illustrative; the
  page says so. Test it headless with Node: `node -e "const S=require('./sim.js');const s=new S();for(let i=0;i<600;i++)s.step();console.log(s.fronts())"`.
- Numbers on the page come from the paper's calibration and performance runs (paper/manu.tex,
  paper/data). The agent replay is trial T4 (paper/agent/t4/calls.jsonl) with the tool results it got.
- Images: renders and app screenshots in img/ (app shots taken with GRANUM_SHOT after the rename to
  GranumFL); figures converted from paper/figs.
- Live at https://granumfl.github.io/ from repo granumFL/granumFL.github.io (GitHub Pages, main /).
- Downloads: the Education zips are Release assets, not in git. New version: from the repository root
  `bash dist/education/package.sh MAC_X86_DIR MAC_ARM_DIR WIN_DIR VER` (writes web/downloads/), then
  `gh release create vVER web/downloads/GranumFL-Education-* web/downloads/SHA256SUMS.txt -R granumFL/granumFL.github.io`,
  update downloads/config.js and push. LICENSE-EDUCATION.txt and README-EDUCATION.txt are copies of dist/education.
