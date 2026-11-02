GRANUMFL EDUCATION EDITION - QUICK START

GranumFL couples discrete element grains (Granum) with SPH water, so that saturated soil,
debris flows and floods can be modelled together. It keeps all of Granum's laboratory tests
and staged soil models, and adds a "Water + grains" mode with flume templates and real
terrain from a GeoTIFF or the free Copernicus GLO-30 elevation model.

START THE APP
  macOS    Open GranumFL.app. The app is not notarised yet: the first time, right-click it and
           choose Open, or run  xattr -dr com.apple.quarantine GranumFL.app  in Terminal.
  Windows  Run granum.exe. If SmartScreen warns, choose "More info" and "Run anyway".

WATER + GRAINS
  Choose the "Water + grains" mode and start from a template: dam break (Martin and Moyce),
  hydrostatic tank, a grain settling in still water, the quick condition, a saturated debris
  flow down a 25 degree flume, or "terrain" for a real site, then follow the steps Case,
  Terrain, Source & path, Water, Grains, Run. The bundled templates all fit the Education
  limits. On a Mac, and on a PC without an NVIDIA GPU, the coupled solver runs on the CPU, so
  keep cases small and runs short while you learn.

ENGINES
  CUDA on an NVIDIA GPU (Windows; needs the NVIDIA driver and NVRTC from the CUDA toolkit, or
  set TELLUSDEM_NVRTC to the NVRTC DLL), otherwise the CPU. The DEM-only tests can also use
  wgpu (Metal on a Mac, DirectX 12 on Windows).

CHAT ASSISTANT
  Press "Chat assistant" (top right), then Settings: the agent program tigrim is found beside
  the app; enter an API URL, a model and an API key (for example https://openrouter.ai/api/v1
  and deepseek/deepseek-v4.1-flash). Keep tigrim beside granum.

CONNECT AN AI AGENT (MCP)
  Claude Code:     claude mcp add granumfl -- /path/to/granum --mcp
  Claude Desktop, Cursor and others:
                   {"mcpServers": {"granumfl": {"command": "/path/to/granum", "args": ["--mcp"]}}}
  On macOS the program inside the app is GranumFL.app/Contents/MacOS/granum.

EDUCATION LIMITS
  - up to 50,000 particles per discrete element model
  - up to 50,000 grains and 50,000 water particles per water + grains case
  - terrain up to 1 km² in plan (for example 1.25 x 0.8 km)
  - calculations on this computer only; no export for GPU servers, no GIS (.asc) result maps
  - reports, maps and pictures carry an Education watermark
  For teaching and non-commercial academic research only: see LICENSE-EDUCATION.txt.
  Academic Research and Professional licences: tellusfem@gmail.com

WEBSITE AND PAPER
  https://granumfl.github.io/
  Youwai, S. (2026). GranumFL: an agentic, GPU-accelerated coupled DEM-SPH program for debris
  flows on real terrain. Zenodo. https://doi.org/10.5281/zenodo.23858571
